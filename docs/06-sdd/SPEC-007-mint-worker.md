# SPEC-007 — MintWorker (Mint Soroban + Privy Wallet + Fee-bump)

**Objetivo:** Implementar o MintTicketJob que consome payment.confirmed, cria a wallet Privy do comprador, minta o ticket no Soroban com fee-bump via Treasury e atualiza os estados.

**Pré-requisitos:** SPEC-002 (auth/Privy), SPEC-005 (purchase/Outbox), SPEC-006 (contratos)

**Tempo estimado:** 2 dias

---

## 1. Estrutura de arquivos

```
apps/workers/src/
├── main.ts
├── workers.module.ts
├── mint/
│   ├── mint.module.ts
│   ├── mint.worker.ts              ← @Processor("payment.confirmed")
│   ├── mint.service.ts             ← lógica de mint
│   └── __tests__/
│       └── mint.service.spec.ts
└── common/
    ├── stellar/
    │   ├── stellar.module.ts
    │   ├── stellar.service.ts       ← Treasury, fee-bump, Horizon
    │   └── kms.service.ts           ← AWS KMS signing
    └── soroban/
        ├── soroban.module.ts
        └── soroban.service.ts       ← build XDR, invoke contratos
```

---

## 2. StellarService — assinaturas

```typescript
@Injectable()
export class StellarService {
  // Ativa nova conta Stellar (cria e paga base reserve)
  // Patrocinado pela Treasury
  async activateAccount(stellarAddress: string): Promise<string>; // retorna tx hash

  // Cria trustline USDC para uma conta
  // Patrocinado pela Treasury via fee-bump
  async createUsdcTrustline(stellarAddress: string): Promise<string>;

  // Fee-bump: paga o gas de uma transação externa usando a Treasury
  async feeBump(innerXdr: string): Promise<string>; // retorna tx hash

  // Submete XDR assinado para Horizon com retry
  async submitTransaction(xdr: string, options?: {
    maxAttempts?: number;  // default: 5
    backoffMs?: number;    // default: 1000
  }): Promise<StellarTransactionResult>;

  // Busca sequence number atual da conta Treasury
  async getTreasurySequence(): Promise<string>;

  // Verifica saldo XLM da Treasury — alerta se abaixo de 50 XLM
  async checkTreasuryBalance(): Promise<{ balance: number; isLow: boolean }>;
}

// KmsService — assina transações via AWS KMS (nunca expõe chave privada)
@Injectable()
export class KmsService {
  async signTransaction(txHash: Buffer): Promise<Buffer>;
  async getTreasuryAddress(): Promise<string>;
}
```

---

## 3. SorobanService — assinaturas

```typescript
@Injectable()
export class SorobanService {
  // Chama TicketContract.mint()
  // Retorna o ticket_id emitido on-chain
  async mintTicket(params: {
    eventId: string;
    ticketTypeId: string;
    ownerAddress: string;
    purchaseId: string;    // chave de idempotência no contrato
    metadataHash: string;  // SHA-256 hex dos dados off-chain
    transferable: boolean;
  }): Promise<{ ticketId: string; txHash: string }>;

  // Chama EscrowContract.deposit()
  async depositEscrow(params: {
    eventId: string;
    sellerAddress: string;
    amountUsdc: number;
    purchaseId: string;
    releaseAt: number;     // unix timestamp
  }): Promise<{ escrowId: string; txHash: string }>;

  // Chama EscrowContract.release() com multi-sig
  async releaseEscrow(escrowId: string): Promise<{ txHash: string }>;

  // Chama EscrowContract.block()
  async blockEscrow(escrowId: string, reason: string): Promise<{ txHash: string }>;

  // Chama TicketContract.check_in() em batch
  async batchCheckin(checkins: Array<{
    ticketId: string;
    eventId: string;
    staffAddress: string;
    timestamp: number;
  }>): Promise<Array<{ ticketId: string; txHash: string; success: boolean }>>;

  // Build XDR de uma invocação de contrato (sem submeter)
  private buildContractInvocation(params: ContractInvocationParams): string;
}
```

---

## 4. MintWorker — implementação

```typescript
// mint/mint.worker.ts
@Processor("payment.confirmed", {
  concurrency: 5,
  lockDuration: 30_000,      // job considerado travado após 30s
  stalledInterval: 5_000,    // verifica jobs travados a cada 5s
})
export class MintWorker extends WorkerHost {
  async process(job: Job<PaymentConfirmedPayload>): Promise<void> {
    const span = this.tracer.startSpan("mint.ticket");
    try {
      await this.mintService.processPaymentConfirmed(job.data);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error; // BullMQ faz retry automaticamente
    } finally {
      span.end();
    }
  }
}

// Configuração de retry — apps/workers/src/workers.module.ts
BullModule.registerQueue({
  name: "payment.confirmed",
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 }, // 1s, 2s, 4s, 8s, 16s
    removeOnComplete: false,   // mantém histórico
    removeOnFail: false,       // vai para DLQ
  },
});
```

---

## 5. MintService — fluxo completo

```typescript
// mint/mint.service.ts
@Injectable()
export class MintService {
  async processPaymentConfirmed(payload: PaymentConfirmedPayload): Promise<void> {
    const { purchaseId, blindpayPayinId, eventId, ticketTypeId, buyerUserId, amountUsdc } = payload;

    // 1. Busca purchase (verifica se ainda precisa processar)
    const purchase = await this.prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (purchase.status === PurchaseStatus.TICKET_ISSUED) {
      return; // idempotência: já processado
    }
    if (purchase.status !== PurchaseStatus.PAYMENT_CONFIRMED) {
      throw new Error(`Purchase ${purchaseId} in unexpected status: ${purchase.status}`);
    }

    // 2. Garante wallet Privy do comprador
    const stellarAddress = await this.privyService.getOrCreateStellarWallet(payload.privyUserId);

    // 3. Garante conta Stellar ativa e trustline USDC
    await this.stellarService.activateAccount(stellarAddress);
    await this.stellarService.createUsdcTrustline(stellarAddress);

    // 4. Busca dados do evento para calcular release_at
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const releaseAt = Math.floor(event.eventDate.getTime() / 1000)
      + (event.securityWindowDays * 86400);

    // 5. Mint do ticket no TicketContract
    const metadataHash = this.computeMetadataHash(purchase);
    const { ticketId, txHash: mintTxHash } = await this.sorobanService.mintTicket({
      eventId: event.sorobanEventId!,
      ticketTypeId,
      ownerAddress: stellarAddress,
      purchaseId,
      metadataHash,
      transferable: false, // MVP: ingressos não transferíveis por padrão
    });

    // 6. Depósito no EscrowContract
    const sellerWallet = await this.prisma.walletAccount.findFirst({
      where: { organizationId: event.organizationId },
    });
    const { escrowId } = await this.sorobanService.depositEscrow({
      eventId: event.sorobanEventId!,
      sellerAddress: sellerWallet!.stellarAddress,
      amountUsdc,
      purchaseId,
      releaseAt,
    });

    // 7. Persiste no banco (tudo em uma transação)
    await this.prisma.$transaction(async (tx) => {
      // Cria Ticket
      await tx.ticket.create({
        data: {
          purchaseId,
          ticketTypeId,
          buyerUserId,
          eventId,
          sorobanTicketId: ticketId,
          stellarTxHash: mintTxHash,
          status: TicketStatus.ISSUED,
          issuedAt: new Date(),
        },
      });

      // Cria Balance (saldo pendente do produtor)
      await tx.balance.create({
        data: {
          eventId,
          organizationId: event.organizationId,
          sorobanEscrowId: escrowId,
          amountUsdc: amountUsdc,
          amountBrlEquiv: Number(purchase.amountBrl),
          status: BalanceStatus.PENDING_SETTLEMENT,
          releaseAt: new Date(releaseAt * 1000),
        },
      });

      // Atualiza incrementa quantitySold
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { quantitySold: { increment: 1 } },
      });

      // Atualiza status da purchase
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: PurchaseStatus.TICKET_ISSUED },
      });

      // Publica domain event
      await this.outboxService.publish(tx, "ticket.issued", purchaseId, {
        ticketId, eventId, buyerUserId, escrowId,
      });

      // Ledger financeiro
      await tx.financialLedger.create({
        data: {
          organizationId: event.organizationId,
          eventId,
          entryType: LedgerEntryType.PAYMENT_RECEIVED,
          amountBrl: purchase.amountBrl,
          referenceId: purchaseId,
          referenceType: "purchase",
        },
      });
    });
  }

  private computeMetadataHash(purchase: Purchase): string {
    // SHA-256 de { purchaseId, buyerEmail, ticketTypeId, amountBrl }
    // Dados pessoais ficam OFF-CHAIN, apenas o hash vai on-chain
    const data = JSON.stringify({ id: purchase.id, amount: purchase.amountBrl.toString() });
    return createHash("sha256").update(data).digest("hex");
  }
}
```

---

## 6. Graceful shutdown (apps/workers/src/main.ts)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(WorkersModule);

  process.on("SIGTERM", async () => {
    logger.log("SIGTERM received — draining jobs...");
    await app.close(); // BullMQ drena jobs em execução (até lockDuration)
    process.exit(0);
  });

  await app.listen(0); // workers não servem HTTP (porta 0 = não escuta)
}
```

---

## 7. Testes esperados

### Unitários
- `MintService.processPaymentConfirmed` é idempotente (status TICKET_ISSUED → retorna sem processar)
- `MintService.processPaymentConfirmed` cria Ticket, Balance, FinancialLedger em uma transação
- `MintService.processPaymentConfirmed` publica "ticket.issued" no Outbox
- `StellarService.submitTransaction` retenta em ECONNRESET
- `StellarService.submitTransaction` busca nova sequence em tx_bad_seq antes de retentar
- `StellarService.checkTreasuryBalance` retorna isLow=true quando XLM < 50
- `SorobanService.mintTicket` não retenta em erro do contrato (HostError)

### Integração
- Worker consome job da fila e cria Ticket no banco (Privy e Soroban mockados)
- Worker retenta automaticamente após ECONNRESET simulado
- Segundo job com mesmo purchaseId retorna sem criar Ticket duplicado

---

## 8. Definição de Pronto

- [ ] MintWorker consome fila `payment.confirmed` e processa
- [ ] Ticket criado no banco após mint on-chain
- [ ] Balance criado com status PENDING_SETTLEMENT
- [ ] FinancialLedger registrado (append-only)
- [ ] Idempotência: segundo job com mesmo purchaseId não cria duplicata
- [ ] Graceful shutdown aguarda jobs em execução terminarem
- [ ] Todos os testes passam
