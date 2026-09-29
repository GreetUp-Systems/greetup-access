# SPEC-001 — Foundation

> ⚠️ **Válida, com resíduos** — o schema Prisma ainda traz `WITHDRAW_ESCROW_DONE` e `sorobanEscrowId`, e a árvore usa `access-platform/`; remover ao implementar (D-12). Em qualquer conflito, vale o [MVP-REVISADO.md](./MVP-REVISADO.md).

**Objetivo:** Configurar o monorepo Turborepo, schema Prisma completo, Docker para dev, variáveis de ambiente e estrutura base de todos os apps.

**Pré-requisitos:** Nenhum. Esta é a primeira spec.

**Tempo estimado:** 1 dia

---

## 1. Estrutura de arquivos a criar

```
access-platform/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── health/
│   │   │       ├── health.module.ts
│   │   │       └── health.controller.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── next.config.ts
│   └── workers/
│       ├── src/
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       ← schema completo definido abaixo
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── index.ts            ← exporta PrismaService e PrismaModule
│   │   └── package.json
│   ├── shared/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/
│   │   │   │   ├── ticket.types.ts
│   │   │   │   ├── finance.types.ts
│   │   │   │   └── events.types.ts
│   │   │   └── constants/
│   │   │       └── index.ts
│   │   └── package.json
│   └── config/
│       ├── eslint.config.js
│       ├── tsconfig.base.json
│       └── package.json
```

---

## 2. Schema Prisma completo

Arquivo: `packages/database/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_DIRECT")
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum OrganizationStatus {
  PENDING_KYB
  ACTIVE
  SUSPENDED
}

enum KYBStatus {
  PENDING
  APPROVED
  REJECTED
  UNDER_REVIEW
}

enum EventStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  POSTPONED
  COMPLETED
}

enum PurchaseStatus {
  INITIATED
  AWAITING_PAYMENT
  PAYMENT_CONFIRMED
  TICKET_ISSUED
  PAYMENT_FAILED
  PAYMENT_EXPIRED
  PAYMENT_REFUNDED
}

enum TicketStatus {
  RESERVED
  ISSUED
  CHECKED_IN
  CANCELLED
  REFUNDED
  EXPIRED
  INVALIDATED
}

enum BalanceStatus {
  PENDING_SETTLEMENT
  BLOCKED
  AVAILABLE
  WITHDRAWN
  REFUNDED
  DISPUTED
}

enum WithdrawalStatus {
  WITHDRAW_REQUESTED
  WITHDRAW_ESCROW_DONE
  WITHDRAW_PAYOUT_SENT
  WITHDRAWN
  WITHDRAW_FAILED
}

enum DomainEventStatus {
  PENDING
  PROCESSED
  FAILED
}

enum LedgerEntryType {
  PAYMENT_RECEIVED
  GREETUP_FEE
  BLINDPAY_FEE
  BALANCE_RELEASED
  BALANCE_BLOCKED
  WITHDRAWAL_INITIATED
  WITHDRAWAL_COMPLETED
  REFUND_ISSUED
  DISPUTE_HOLD
  DISPUTE_RESOLVED
}

// ─── Models ──────────────────────────────────────────────────────────────────

model Organization {
  id                  String             @id @default(uuid())
  name                String
  email               String             @unique
  cnpj                String?            @unique
  status              OrganizationStatus @default(PENDING_KYB)
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  blindPayReceiver    BlindPayReceiver?
  walletAccount       WalletAccount?
  events              Event[]
  balances            Balance[]
  withdrawals         Withdrawal[]
  staffAccesses       StaffAccess[]
  financialLedger     FinancialLedger[]

  @@map("organizations")
}

model BlindPayReceiver {
  id                    String    @id @default(uuid())
  organizationId        String    @unique @map("organization_id")
  blindpayReceiverId    String    @unique @map("blindpay_receiver_id")
  kybStatus             KYBStatus @default(PENDING) @map("kyb_status")
  pixKey                String?   @map("pix_key")
  bankAccountId         String?   @map("bank_account_id")
  blindpayWalletId      String?   @map("blindpay_wallet_id")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  organization          Organization @relation(fields: [organizationId], references: [id])

  @@map("blindpay_receivers")
}

model WalletAccount {
  id              String   @id @default(uuid())
  organizationId  String?  @unique @map("organization_id")
  buyerUserId     String?  @map("buyer_user_id")
  stellarAddress  String   @unique @map("stellar_address")
  privyWalletId   String?  @unique @map("privy_wallet_id")
  walletType      String   @map("wallet_type") // "organization" | "buyer"
  createdAt       DateTime @default(now()) @map("created_at")

  organization    Organization? @relation(fields: [organizationId], references: [id])
  buyerUser       BuyerUser?    @relation(fields: [buyerUserId], references: [id])

  @@map("wallet_accounts")
}

model BuyerUser {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String?
  privyUserId   String?  @unique @map("privy_user_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  walletAccount WalletAccount?
  purchases     Purchase[]

  @@map("buyer_users")
}

model Event {
  id                   String      @id @default(uuid())
  organizationId       String      @map("organization_id")
  slug                 String      @unique
  name                 String
  description          String?
  location             String?
  eventDate            DateTime    @map("event_date")
  capacityMax          Int         @map("capacity_max")
  status               EventStatus @default(DRAFT)
  sorobanEventId       String?     @map("soroban_event_id")
  securityWindowDays   Int         @default(7) @map("security_window_days")
  refundPolicy         Json        @map("refund_policy")
  coverImageUrl        String?     @map("cover_image_url")
  createdAt            DateTime    @default(now()) @map("created_at")
  updatedAt            DateTime    @updatedAt @map("updated_at")

  organization         Organization  @relation(fields: [organizationId], references: [id])
  ticketTypes          TicketType[]
  purchases            Purchase[]
  balances             Balance[]
  staffAccesses        StaffAccess[]
  checkinEvents        CheckinEvent[]

  @@map("events")
}

model TicketType {
  id              String   @id @default(uuid())
  eventId         String   @map("event_id")
  name            String
  description     String?
  priceBrl        Decimal  @map("price_brl") @db.Decimal(10, 2)
  quantityTotal   Int      @map("quantity_total")
  quantitySold    Int      @default(0) @map("quantity_sold")
  transferable    Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  event           Event      @relation(fields: [eventId], references: [id])
  purchases       Purchase[]
  tickets         Ticket[]

  @@map("ticket_types")
}

model Purchase {
  id                  String         @id @default(uuid())
  eventId             String         @map("event_id")
  ticketTypeId        String         @map("ticket_type_id")
  buyerUserId         String         @map("buyer_user_id")
  status              PurchaseStatus @default(INITIATED)
  amountBrl           Decimal        @map("amount_brl") @db.Decimal(10, 2)
  blindpayPayinId     String?        @unique @map("blindpay_payin_id")
  blindpayQuoteId     String?        @map("blindpay_quote_id")
  pixCode             String?        @map("pix_code")
  pixExpiresAt        DateTime?      @map("pix_expires_at")
  attempts            Int            @default(0)
  createdAt           DateTime       @default(now()) @map("created_at")
  updatedAt           DateTime       @updatedAt @map("updated_at")

  event               Event      @relation(fields: [eventId], references: [id])
  ticketType          TicketType @relation(fields: [ticketTypeId], references: [id])
  buyerUser           BuyerUser  @relation(fields: [buyerUserId], references: [id])
  ticket              Ticket?

  @@map("purchases")
}

model Ticket {
  id                String       @id @default(uuid())
  purchaseId        String       @unique @map("purchase_id")
  ticketTypeId      String       @map("ticket_type_id")
  buyerUserId       String       @map("buyer_user_id")
  eventId           String       @map("event_id")
  sorobanTicketId   String?      @unique @map("soroban_ticket_id")
  stellarTxHash     String?      @map("stellar_tx_hash")
  status            TicketStatus @default(RESERVED)
  qrNonce           String       @unique @default(uuid()) @map("qr_nonce")
  issuedAt          DateTime?    @map("issued_at")
  expiresAt         DateTime?    @map("expires_at")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  purchase          Purchase       @relation(fields: [purchaseId], references: [id])
  ticketType        TicketType     @relation(fields: [ticketTypeId], references: [id])
  checkinEvents     CheckinEvent[]

  @@map("tickets")
}

model CheckinEvent {
  id              String    @id @default(uuid())
  ticketId        String    @map("ticket_id")
  eventId         String    @map("event_id")
  staffUserId     String?   @map("staff_user_id")
  stellarTxHash   String?   @map("stellar_tx_hash")
  deviceId        String?   @map("device_id")
  isConflict      Boolean   @default(false) @map("is_conflict")
  checkedInAt     DateTime  @map("checked_in_at")
  syncedAt        DateTime? @map("synced_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  ticket          Ticket @relation(fields: [ticketId], references: [id])
  event           Event  @relation(fields: [eventId], references: [id])

  @@map("checkin_events")
}

model Balance {
  id                String        @id @default(uuid())
  eventId           String        @map("event_id")
  organizationId    String        @map("organization_id")
  sorobanEscrowId   String?       @unique @map("soroban_escrow_id")
  amountUsdc        Decimal       @map("amount_usdc") @db.Decimal(20, 6)
  amountBrlEquiv    Decimal       @map("amount_brl_equiv") @db.Decimal(10, 2)
  status            BalanceStatus @default(PENDING_SETTLEMENT)
  releaseAt         DateTime?     @map("release_at")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  event             Event        @relation(fields: [eventId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id])
  withdrawals       Withdrawal[]

  @@map("balances")
}

model Withdrawal {
  id                    String           @id @default(uuid())
  organizationId        String           @map("organization_id")
  balanceId             String           @map("balance_id")
  amountUsdc            Decimal          @map("amount_usdc") @db.Decimal(20, 6)
  amountBrl             Decimal          @map("amount_brl") @db.Decimal(10, 2)
  status                WithdrawalStatus @default(WITHDRAW_REQUESTED)
  blindpayPayoutId      String?          @unique @map("blindpay_payout_id")
  stellarTxHash         String?          @map("stellar_tx_hash")
  pixKey                String?          @map("pix_key")
  requestedAt           DateTime         @default(now()) @map("requested_at")
  completedAt           DateTime?        @map("completed_at")
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")

  organization          Organization @relation(fields: [organizationId], references: [id])
  balance               Balance      @relation(fields: [balanceId], references: [id])

  @@map("withdrawals")
}

model DomainEvent {
  id            String            @id @default(uuid())
  aggregateId   String            @map("aggregate_id")
  eventType     String            @map("event_type")
  payload       Json
  status        DomainEventStatus @default(PENDING)
  retryCount    Int               @default(0) @map("retry_count")
  error         String?
  createdAt     DateTime          @default(now()) @map("created_at")
  processedAt   DateTime?         @map("processed_at")

  @@unique([aggregateId, eventType])
  @@index([status, createdAt])
  @@map("domain_events")
}

model FinancialLedger {
  id              String          @id @default(uuid())
  organizationId  String          @map("organization_id")
  eventId         String?         @map("event_id")
  entryType       LedgerEntryType @map("entry_type")
  amountBrl       Decimal         @map("amount_brl") @db.Decimal(10, 2)
  referenceId     String          @map("reference_id")
  referenceType   String          @map("reference_type")
  createdAt       DateTime        @default(now()) @map("created_at")

  organization    Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, createdAt])
  @@map("financial_ledger")
}

model StaffAccess {
  id              String   @id @default(uuid())
  eventId         String   @map("event_id")
  organizationId  String   @map("organization_id")
  email           String
  role            String   @default("staff")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")

  event           Event        @relation(fields: [eventId], references: [id])
  organization    Organization @relation(fields: [organizationId], references: [id])

  @@unique([eventId, email])
  @@map("staff_accesses")
}
```

---

## 3. PrismaService (packages/database/src/index.ts)

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
```

---

## 4. Health check (apps/api/src/health/)

```typescript
// health.controller.ts
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<{ status: string; db: string; redis: string; ts: string }> {
    const [dbOk, redisOk] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);
    return {
      status: "ok",
      db: dbOk.status === "fulfilled" ? "ok" : "error",
      redis: redisOk.status === "fulfilled" ? "ok" : "error",
      ts: new Date().toISOString(),
    };
  }
}
```

---

## 5. Migrations SQL necessárias

Após `prisma migrate dev --name init`, adicionar manualmente:

```sql
-- Habilitar RLS em tabelas de tenant
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY tenant_isolation_events ON events
  USING (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_balances ON balances
  USING (organization_id::text = current_setting('app.current_organization_id', true));

-- (repetir para cada tabela com organization_id)

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
-- (repetir para cada tabela com updated_at)
```

---

## 6. Testes esperados

### Unitários
- `PrismaService` conecta e desconecta corretamente
- Health controller retorna `{ status: "ok" }` quando Postgres e Redis respondem
- Health controller retorna status de erro individualizado quando um dos serviços está offline

### Integração
- `GET /health` retorna 200 com Postgres e Redis rodando (docker-compose.test.yml)
- `GET /health` retorna 200 com status parcial quando Redis está indisponível

---

## 7. Variáveis de ambiente necessárias

```bash
DATABASE_URL=postgresql://greetup:greetup@localhost:5432/greetup_dev
DATABASE_URL_DIRECT=postgresql://greetup:greetup@localhost:5432/greetup_dev
REDIS_URL=redis://localhost:6379
```

---

## 8. Definição de Pronto

- [ ] `pnpm install` executa sem erro
- [ ] `pnpm turbo build` compila todos os apps
- [ ] `docker compose up -d` sobe Postgres e Redis
- [ ] `pnpm db:migrate` executa sem erro
- [ ] `GET /health` retorna `{ status: "ok", db: "ok", redis: "ok" }`
- [ ] `pnpm turbo typecheck` sem erros
- [ ] `pnpm turbo test` passa (unitários do health)
