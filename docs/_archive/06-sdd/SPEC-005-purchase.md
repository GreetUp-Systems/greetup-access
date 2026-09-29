# SPEC-005 — Purchase (Compra Pix + BlindPay Payin + Webhook + Outbox)

**Objetivo:** Implementar o fluxo completo de compra: geração de QR Code Pix via BlindPay, recebimento de webhook de confirmação, escrita atômica no Outbox e enfileiramento do MintTicketJob.

**Pré-requisitos:** SPEC-001, SPEC-002, SPEC-003, SPEC-004

**Tempo estimado:** 2 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── purchases/
│   ├── purchases.module.ts
│   ├── purchases.controller.ts
│   ├── purchases.service.ts
│   ├── dto/
│   │   ├── create-purchase.dto.ts
│   │   └── purchase-response.dto.ts
│   └── __tests__/
│       ├── purchases.service.spec.ts
│       └── purchases.integration.spec.ts
├── webhooks/
│   ├── webhooks.module.ts
│   ├── webhooks.controller.ts     ← POST /webhooks/blindpay (público, validação HMAC)
│   ├── webhooks.service.ts
│   └── __tests__/
│       └── webhooks.integration.spec.ts
└── common/
    └── outbox/
        ├── outbox.module.ts
        ├── outbox.service.ts      ← escreve domain_events na mesma tx
        └── outbox-relay.service.ts ← polling 500ms, publica no BullMQ
```

---

## 2. OutboxService — assinatura crítica

```typescript
// REGRA: este serviço SEMPRE deve ser chamado dentro de um prisma.$transaction
@Injectable()
export class OutboxService {
  // tx é o PrismaClient transacional — nunca usar this.prisma direto aqui
  async publish(
    tx: Prisma.TransactionClient,
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.domainEvent.create({
      data: {
        aggregateId,
        eventType,
        payload,
        status: DomainEventStatus.PENDING,
      },
    });
    // Não publica no BullMQ aqui — responsabilidade do OutboxRelay
  }
}

// outbox-relay.service.ts — processo separado (apps/workers)
@Injectable()
export class OutboxRelayService implements OnModuleInit {
  // Polling a cada 500ms
  // Busca domain_events WHERE status = PENDING ORDER BY created_at ASC LIMIT 50
  // Para cada evento: publica na fila BullMQ correspondente
  // Atualiza status = PROCESSED após ACK
  // Em caso de falha: incrementa retryCount, salva error
  // Após 3 falhas: status = FAILED, alerta

  async onModuleInit(): Promise<void>; // inicia o polling
  private async processOutbox(): Promise<void>;
  private getQueueForEventType(eventType: string): Queue;
}
```

---

## 3. PurchasesService — assinaturas

```typescript
@Injectable()
export class PurchasesService {
  // Inicia compra: cria Purchase + cria payin no BlindPay + retorna QR Code Pix
  async initiate(
    dto: CreatePurchaseDto,
    buyerUser: BuyerUser,
  ): Promise<{ purchaseId: string; pixCode: string; pixExpiresAt: Date; amountBrl: number }>;

  // Processa confirmação de pagamento (chamado pelo webhook handler)
  // Executa dentro de prisma.$transaction
  // 1. Verifica idempotência: se já processado, retorna sem erro
  // 2. Atualiza Purchase.status = PAYMENT_CONFIRMED
  // 3. Chama OutboxService.publish(tx, "payment.confirmed", purchaseId, payload)
  async confirmPayment(blindpayPayinId: string, amountUsdc: number): Promise<void>;

  // Marca como expirado (chamado por cron quando pixExpiresAt passou)
  async expirePurchase(purchaseId: string): Promise<void>;

  // Busca purchase com verificação de ownership
  async findOne(purchaseId: string, buyerUserId: string): Promise<Purchase>;
}
```

---

## 4. WebhooksController — implementação crítica

```typescript
@Controller("webhooks")
export class WebhooksController {
  @Post("blindpay")
  @Public()
  @HttpCode(200)
  async blindpayWebhook(
    @Headers("blindpay-signature") signature: string,
    @Body() body: BlindPayWebhookPayload,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    // 1. Valida HMAC-SHA256 sobre o corpo RAW (não o body parseado)
    // IMPORTANTE: usar req.rawBody, não JSON.stringify(body)
    const isValid = this.blindPayService.validateWebhookSignature(req.rawBody, signature);
    if (!isValid) throw new UnauthorizedException("Invalid webhook signature");

    // 2. Identifica o tipo de evento
    switch (body.event) {
      case "payin.completed":
        await this.purchasesService.confirmPayment(body.payin_id, body.amount_usdc);
        break;
      case "payout.completed":
        await this.withdrawalsService.confirmPayout(body.payout_id);
        break;
      // outros eventos...
    }

    // 3. Responde IMEDIATAMENTE — nunca await de operações longas aqui
    return { received: true };
    // Nota: confirmPayment já é rápido pois só escreve no banco + outbox
    // O mint pesado acontece no worker, não aqui
  }
}
```

---

## 5. Endpoints

### POST /purchases
```
Auth: comprador (token Privy)
Body: {
  eventId: string,
  ticketTypeId: string,
  quantity: 1,          // MVP: sempre 1
}
Response 201: {
  purchaseId: string,
  pixCode: string,       // QR Code Pix para o frontend exibir
  pixExpiresAt: string,  // ISO 8601
  amountBrl: number,
  eventName: string,
  ticketTypeName: string,
}
Erros:
  404 — evento ou ticket type não encontrado
  400 — evento não publicado ou sem capacidade
  409 — comprador já tem ingresso para este evento (MVP: 1 por pessoa)
```

### GET /purchases/:id
```
Auth: comprador owner da purchase
Response 200: Purchase com status atual
```

---

## 6. Tipos de domain events publicados nesta spec

```typescript
// Publicados no Outbox e consumidos pelos workers:
"payment.confirmed" → payload: { purchaseId, blindpayPayinId, amountUsdc, eventId, ticketTypeId, buyerUserId }
"payment.failed"    → payload: { purchaseId, reason }
"payment.expired"   → payload: { purchaseId }
```

---

## 7. Testes esperados

### Unitários
- `PurchasesService.initiate` chama BlindPayService.createPayinQuote com valor correto
- `PurchasesService.confirmPayment` é idempotente (segunda chamada com mesmo payin_id não faz nada)
- `PurchasesService.confirmPayment` escreve no Outbox dentro da mesma transação
- `WebhooksController` rejeita webhook com HMAC inválido (401)
- `WebhooksController` retorna 200 imediatamente sem esperar o worker processar
- `OutboxRelayService` publica evento PENDING no BullMQ e marca como PROCESSED
- `OutboxRelayService` incrementa retryCount em caso de falha do BullMQ

### Integração
- Compra completa: `POST /purchases` → webhook simulado → `domain_events` com status PROCESSED
- Segunda chamada de webhook com mesmo payin_id não cria evento duplicado
- `POST /purchases` com evento sem capacidade retorna 400

---

## 8. Configuração de Raw Body no NestJS

```typescript
// apps/api/src/main.ts
const app = await NestFactory.create(AppModule, {
  rawBody: true, // necessário para validar HMAC do webhook
});
```

---

## 9. Variáveis necessárias

```bash
BLINDPAY_WEBHOOK_SECRET=          # para validar HMAC
STELLAR_NETWORK=testnet           # destino do USDC no payin
SOROBAN_ESCROW_CONTRACT_ADDRESS=  # wallet destino do payin BlindPay
```

---

## 10. Definição de Pronto

- [ ] `POST /purchases` gera QR Code Pix em menos de 3s
- [ ] Webhook BlindPay recebido e processado em menos de 200ms
- [ ] Webhook duplicado não cria evento duplicado (idempotência)
- [ ] HMAC inválido retorna 401
- [ ] OutboxRelay publica events PENDING no BullMQ
- [ ] `domain_events` com status PROCESSED após processamento
- [ ] Todos os testes passam
