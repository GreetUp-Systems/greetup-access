# SPEC-009 — Checkin (Snapshot HMAC + PWA Offline + IndexedDB + Sync)

> ⚠️ **SPEC a dividir** — check-in online na fase 1; capacidade offline na fase 2 (D-19). Em qualquer conflito, vale o [MVP-REVISADO.md](./MVP-REVISADO.md). Não implemente a partir desta versão.

**Objetivo:** Implementar o sistema completo de credenciamento: geração de snapshot assinado, validação offline no PWA (IndexedDB + Service Worker), sincronização em batch e registro on-chain.

**Pré-requisitos:** SPEC-007, SPEC-008

**Tempo estimado:** 2-3 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── checkin/
│   ├── checkin.module.ts
│   ├── checkin.controller.ts       ← /checkin/* endpoints
│   ├── checkin.service.ts
│   ├── snapshot.service.ts         ← gera snapshot assinado
│   └── __tests__/
│       ├── checkin.service.spec.ts
│       └── checkin.integration.spec.ts

apps/web/
├── app/
│   └── checkin/
│       └── [eventId]/
│           ├── page.tsx             ← tela do scanner (staff)
│           └── components/
│               ├── QrScanner.tsx
│               ├── CheckinResult.tsx
│               └── SyncStatus.tsx
├── lib/
│   ├── checkin/
│   │   ├── db.ts                   ← IndexedDB schema (Dexie.js)
│   │   ├── validator.ts            ← validação local de QR Code
│   │   ├── sync.ts                 ← sincronização com API
│   │   └── snapshot.ts             ← download e armazenamento do snapshot
└── public/
    └── sw.js                       ← Service Worker (gerado pelo next-pwa)
```

---

## 2. SnapshotService — assinatura

```typescript
export interface TicketSnapshot {
  ticketId: string;
  sorobanTicketId: string;
  status: TicketStatus;
  holderName: string | null;
  ticketTypeName: string;
  qrNonce: string;        // nonce atual do ticket para validação local
}

export interface EventSnapshot {
  eventId: string;
  eventName: string;
  generatedAt: number;     // unix timestamp
  validUntil: number;      // unix timestamp (geração + 24h)
  hmacKey: string;         // chave HMAC para validar QR Codes offline
  tickets: TicketSnapshot[];
  signature: string;       // HMAC-SHA256 do snapshot inteiro
}

@Injectable()
export class SnapshotService {
  // Gera snapshot completo de tickets válidos para um evento
  // Inclui todos os tickets com status ISSUED
  // NUNCA inclui dados pessoais além do nome do titular
  async generate(eventId: string, organizationId: string): Promise<EventSnapshot>;

  // Verifica se um snapshot existente ainda é válido (< 24h)
  isValid(snapshot: EventSnapshot): boolean;

  // Assina o snapshot com HMAC
  private sign(snapshot: Omit<EventSnapshot, "signature">): string;
}
```

---

## 3. CheckinService — assinatura

```typescript
export interface CheckinSyncPayload {
  checkins: Array<{
    ticketId: string;
    eventId: string;
    qrPayload: QrCodePayload;   // payload completo do QR escaneado
    checkedInAt: string;        // ISO 8601
    deviceId: string;
  }>;
}

export interface CheckinSyncResult {
  synced: number;
  conflicts: number;
  failed: number;
  results: Array<{
    ticketId: string;
    success: boolean;
    isConflict: boolean;
    reason?: string;
  }>;
}

@Injectable()
export class CheckinService {
  // Valida e persiste batch de check-ins vindos do PWA
  // Cada item é verificado: assinatura QR, status do ticket, unicidade
  async syncBatch(
    payload: CheckinSyncPayload,
    staffUserId: string,
    organizationId: string,
  ): Promise<CheckinSyncResult>;

  // Registra check-in individual (fallback online)
  async checkin(ticketId: string, qrPayload: QrCodePayload, staffUserId: string): Promise<void>;

  // Busca status de presença de um evento
  async getPresenceStats(eventId: string, organizationId: string): Promise<{
    total: number;
    checkedIn: number;
    percentage: number;
  }>;
}
```

---

## 4. Endpoints

### GET /events/:id/ticket-snapshot
```
Auth: staff com acesso ao evento
Response 200: EventSnapshot
Headers: Cache-Control: no-store (nunca cacheado no browser — sensível)
Nota: o snapshot pode ter até 10MB para eventos grandes — retornar com streaming
```

### POST /checkin/sync
```
Auth: staff
Body: CheckinSyncPayload
Response 200: CheckinSyncResult
Nota: processa em batch, responde com resultado de cada item
```

### GET /events/:id/presence
```
Auth: produtor owner do evento
Response 200: { total, checkedIn, percentage }
Cache: Redis com TTL 5s (atualizado em tempo real via WebSocket)
```

---

## 5. PWA — IndexedDB Schema (Dexie.js)

```typescript
// apps/web/lib/checkin/db.ts
import Dexie, { type Table } from "dexie";

export interface StoredTicket {
  ticketId: string;        // primary key
  eventId: string;
  status: string;
  holderName: string | null;
  ticketTypeName: string;
  qrNonce: string;
  checkedInAt?: number;   // unix timestamp (se feito offline)
  isLocalOnly: boolean;   // true se ainda não sincronizado
}

export interface SyncQueueItem {
  id?: number;            // auto-increment
  ticketId: string;
  eventId: string;
  qrPayload: string;      // JSON do payload do QR
  checkedInAt: number;
  deviceId: string;
  retries: number;
}

export class CheckinDatabase extends Dexie {
  tickets!: Table<StoredTicket>;
  syncQueue!: Table<SyncQueueItem>;
  snapshots!: Table<{ eventId: string; data: string; generatedAt: number }>;

  constructor() {
    super("greetup-checkin");
    this.version(1).stores({
      tickets: "ticketId, eventId, status",
      syncQueue: "++id, ticketId, eventId",
      snapshots: "eventId",
    });
  }
}
```

---

## 6. PWA — Lógica de validação offline

```typescript
// apps/web/lib/checkin/validator.ts
import { createHmac } from "crypto"; // disponível no browser via polyfill

export type ValidationResult =
  | { valid: true; ticket: StoredTicket }
  | { valid: false; reason: "ALREADY_USED" | "INVALID_SIGNATURE" | "WRONG_EVENT" | "CANCELLED" | "EXPIRED" | "NOT_FOUND"; checkedInAt?: number };

export async function validateQrCode(
  rawPayload: string,
  eventId: string,
  db: CheckinDatabase,
  hmacKey: string,
): Promise<ValidationResult> {
  // 1. Parseia e valida estrutura do payload
  let payload: QrCodePayload;
  try { payload = JSON.parse(rawPayload); }
  catch { return { valid: false, reason: "INVALID_SIGNATURE" }; }

  // 2. Verifica se é do evento correto
  if (payload.event_id !== eventId) return { valid: false, reason: "WRONG_EVENT" };

  // 3. Verifica assinatura HMAC
  const { signature, ...rest } = payload;
  const expectedSig = createHmac("sha256", hmacKey)
    .update(JSON.stringify(rest))
    .digest("hex");
  if (signature !== expectedSig) return { valid: false, reason: "INVALID_SIGNATURE" };

  // 4. Busca ticket no IndexedDB
  const ticket = await db.tickets.get(payload.ticket_id);
  if (!ticket) return { valid: false, reason: "NOT_FOUND" };

  // 5. Verifica status
  if (ticket.checkedInAt) return { valid: false, reason: "ALREADY_USED", checkedInAt: ticket.checkedInAt };
  if (ticket.status === "cancelled") return { valid: false, reason: "CANCELLED" };

  return { valid: true, ticket };
}
```

---

## 7. CheckinSyncWorker (apps/workers)

```typescript
// Consome "checkin.batch.pending"
// Registra on-chain via SorobanService.batchCheckin()
// Máximo 10 checkins por chamada on-chain (custo de gas)

@Processor("checkin.batch.pending", { concurrency: 2 })
export class CheckinSyncWorker extends WorkerHost {
  async process(job: Job<CheckinBatchPayload>): Promise<void> {
    const results = await this.sorobanService.batchCheckin(job.data.checkins);
    // Atualiza stellarTxHash nos CheckinEvents do banco
    // Publica WebSocket update para o dashboard do produtor
  }
}
```

---

## 8. Testes esperados

### Unitários
- `SnapshotService.generate` não inclui email ou CPF no snapshot
- `SnapshotService.isValid` retorna false após 24h
- `CheckinService.syncBatch` rejeita QR Code com assinatura inválida
- `CheckinService.syncBatch` marca isConflict=true para segundo check-in do mesmo ticket
- `validateQrCode` retorna ALREADY_USED quando ticket está no IndexedDB como checked

### Integração
- `GET /events/:id/ticket-snapshot` retorna snapshot com HMAC válido
- `POST /checkin/sync` processa batch e retorna resultados individuais
- Segundo sync do mesmo ticket retorna isConflict=true sem criar duplicata

---

## 9. Definição de Pronto

- [ ] Snapshot gerado com HMAC assinado
- [ ] PWA valida QR Code localmente sem internet em < 200ms
- [ ] Check-in salvo no IndexedDB durante offline
- [ ] Background Sync sincroniza automaticamente quando online
- [ ] Conflito de check-in detectado e marcado (isConflict=true)
- [ ] SorobanService.batchCheckin registra on-chain
- [ ] Dashboard do produtor atualiza via WebSocket
- [ ] Todos os testes passam
