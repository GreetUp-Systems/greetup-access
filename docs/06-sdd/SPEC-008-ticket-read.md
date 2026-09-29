# SPEC-008 — Ticket Read (Área do Comprador + QR Code + CQRS Read Side)

**Objetivo:** Implementar a área do comprador (visualização de ingressos, QR Code), o CQRS read side de tickets com cache Redis e a geração segura do payload do QR Code.

**Pré-requisitos:** SPEC-007

**Tempo estimado:** 1 dia

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── tickets/
│   ├── tickets.module.ts
│   ├── tickets.controller.ts
│   ├── tickets.service.ts          ← write side
│   ├── tickets-query.service.ts    ← CQRS read side
│   ├── qr-code.service.ts          ← geração e validação de QR Code
│   └── __tests__/
│       ├── tickets.service.spec.ts
│       └── tickets-query.service.spec.ts
apps/web/
└── app/
    └── my-tickets/
        ├── page.tsx                ← lista de ingressos do comprador
        └── [ticketId]/
            └── page.tsx            ← ingresso individual com QR Code
```

---

## 2. QrCodeService — geração segura

```typescript
// O payload do QR Code é assinado com HMAC-SHA256 usando uma chave por evento
// Validação acontece localmente no PWA (sem internet)

export interface QrCodePayload {
  ticket_id: string;
  event_id: string;
  nonce: string;        // UUID único por QR gerado — previne replay
  issued_at: number;    // unix timestamp
  expires_at: number;   // unix timestamp (expiração do QR, não do ticket)
  signature: string;    // HMAC-SHA256 hex
}

@Injectable()
export class QrCodeService {
  // Gera payload do QR Code assinado
  // expires_at = data do evento + 12 horas (QR válido para uso no dia)
  generate(ticket: Ticket, event: Event): QrCodePayload;

  // Valida assinatura (usado no backend para validar sync de check-ins)
  validate(payload: QrCodePayload, eventId: string): boolean;

  // Retorna a chave HMAC para um evento (usada pelo PWA no snapshot)
  // A chave é rotacionada por evento e nunca exposta publicamente
  getEventHmacKey(eventId: string): string;

  // Gera o URL do QR Code como imagem (data:image/png)
  async generateQrCodeImage(payload: QrCodePayload): Promise<string>;
}
```

---

## 3. TicketsQueryService — CQRS read side

```typescript
// CQRS Read Side: serve dados do Redis com fallback para Postgres
// Nunca escreve — apenas lê

export interface TicketReadModel {
  ticketId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  location: string | null;
  ticketTypeName: string;
  holderName: string | null;
  holderEmail: string;
  status: TicketStatus;
  sorobanTicketId: string | null;
  issuedAt: string | null;
  qrCodePayload: QrCodePayload | null; // null se status != ISSUED
  checkedInAt: string | null;
}

@Injectable()
export class TicketsQueryService {
  private readonly CACHE_TTL = 1800; // 30 minutos

  // Busca ingresso por ID — comprador vê apenas os seus
  async findOne(ticketId: string, buyerUserId: string): Promise<TicketReadModel>;

  // Lista todos os ingressos do comprador
  async findByBuyer(buyerUserId: string): Promise<TicketReadModel[]>;

  // Atualiza a projeção no Redis (chamado pelo ticket.issued worker)
  async updateReadModel(ticketId: string): Promise<void>;

  // Invalida cache quando status muda
  async invalidateCache(ticketId: string): Promise<void>;

  // Chave do cache Redis
  private getCacheKey(ticketId: string): string {
    return `ticket:${ticketId}`;
  }
}
```

---

## 4. TicketReadWorker — atualiza projeção

```typescript
// apps/workers/src/ticket-read/
// Consome "ticket.issued" e "ticket.status.changed"
// Atualiza o read model no Redis

@Processor("ticket.issued")
export class TicketReadWorker extends WorkerHost {
  async process(job: Job<TicketIssuedPayload>): Promise<void> {
    const { ticketId } = job.data;
    await this.ticketsQueryService.updateReadModel(ticketId);
    // WebSocket: notifica comprador
    await this.redis.publish(
      `buyer:${job.data.buyerUserId}:events`,
      JSON.stringify({ type: "ticket.issued", payload: { ticketId } }),
    );
  }
}
```

---

## 5. Endpoints

### GET /tickets/my
```
Auth: comprador
Response 200: TicketReadModel[]
Cache: Redis com TTL 30min
```

### GET /tickets/:id
```
Auth: comprador owner do ticket
Response 200: TicketReadModel com qrCodePayload
```

### GET /tickets/:id/qr-image
```
Auth: comprador owner do ticket
Response 200: { imageUrl: string }  // data:image/png base64
Nota: QR Code gerado fresco a cada requisição (novo nonce) para prevenir replay
```

---

## 6. Testes esperados

### Unitários
- `QrCodeService.generate` cria payload com nonce único a cada chamada
- `QrCodeService.validate` retorna false com payload adulterado
- `QrCodeService.validate` retorna false com signature incorreta
- `TicketsQueryService.findOne` serve do cache Redis quando disponível
- `TicketsQueryService.findOne` faz fallback para Postgres em cache miss
- `TicketsQueryService.findOne` lança NotFoundException se ticket não pertence ao usuário

### Integração
- `GET /tickets/my` retorna ingressos do comprador autenticado
- `GET /tickets/:id` retorna 403 para ingresso de outro usuário
- Após ticket.issued: Redis contém read model atualizado

---

## 7. Definição de Pronto

- [ ] Comprador visualiza seus ingressos com QR Code
- [ ] QR Code tem nonce único a cada geração
- [ ] Cache Redis atualizado pelo worker após mint
- [ ] Leitura serve do Redis sem bater no Postgres na maioria dos casos
- [ ] Todos os testes passam
