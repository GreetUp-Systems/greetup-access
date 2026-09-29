# SPEC-010 — Finance (Ledger + Saldo + EscrowMonitorJob)

**Objetivo:** Implementar o módulo financeiro: ledger append-only, cálculo de saldo por estados, EscrowMonitorJob (cron que libera saldo após janela de segurança) e CQRS read side do dashboard financeiro.

**Pré-requisitos:** SPEC-007 (mint worker cria Balance)

**Tempo estimado:** 2 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── finance/
│   ├── finance.module.ts
│   ├── finance.service.ts           ← write side (ledger, estados)
│   ├── finance-query.service.ts     ← CQRS read side (dashboard)
│   └── __tests__/
│       └── finance.service.spec.ts

apps/workers/src/
├── escrow-monitor/
│   ├── escrow-monitor.module.ts
│   ├── escrow-monitor.worker.ts     ← @Cron a cada 1 minuto
│   └── __tests__/
│       └── escrow-monitor.spec.ts
```

---

## 2. FinancialDashboard — interface do read side

```typescript
export interface FinancialDashboard {
  // Valores em BRL (calculados a partir do USDC via taxa de câmbio registrada)
  grossRevenueBrl: number;
  blindpayFeeBrl: number;
  greetupFeeBrl: number;
  netRevenueBrl: number;

  // Saldos segmentados
  pendingSettlementBrl: number;
  blockedBrl: number;
  availableBrl: number;
  withdrawnBrl: number;
  refundedBrl: number;

  // Contadores
  ticketsSold: number;
  refundCount: number;

  // Datas
  nextReleaseAt: string | null;   // próxima liberação de saldo prevista
  lastUpdatedAt: string;
}
```

---

## 3. FinanceService — assinaturas

```typescript
@Injectable()
export class FinanceService {
  // Transiciona saldo de PENDING_SETTLEMENT para AVAILABLE
  // Chamado pelo EscrowMonitorJob
  // Registra no ledger como BALANCE_RELEASED
  async releaseBalance(balanceId: string): Promise<void>;

  // Bloqueia saldo (cancelamento ou disputa)
  // Registra no ledger como BALANCE_BLOCKED
  async blockBalance(balanceId: string, reason: string): Promise<void>;

  // Registra entrada no ledger (append-only, nunca atualiza)
  async addLedgerEntry(params: {
    organizationId: string;
    eventId?: string;
    entryType: LedgerEntryType;
    amountBrl: number;
    referenceId: string;
    referenceType: string;
  }): Promise<FinancialLedger>;

  // Calcula saldo disponível para retirada (soma de balances AVAILABLE)
  async getAvailableBalance(organizationId: string): Promise<{
    amountUsdc: number;
    amountBrl: number;
  }>;

  // Busca balances elegíveis para liberação (PENDING_SETTLEMENT com releaseAt no passado)
  async findEligibleForRelease(): Promise<Balance[]>;
}
```

---

## 4. EscrowMonitorWorker — cron

```typescript
// apps/workers/src/escrow-monitor/escrow-monitor.worker.ts

@Injectable()
export class EscrowMonitorWorker implements OnModuleInit {
  private readonly logger = new Logger(EscrowMonitorWorker.name);

  onModuleInit() {
    // Registra o cron job — executa a cada 60 segundos
    this.schedulerRegistry.addCronJob(
      "escrow-monitor",
      new CronJob("*/1 * * * *", () => this.run()),
    );
  }

  async run(): Promise<void> {
    const span = this.tracer.startSpan("escrow.monitor.run");
    try {
      const eligible = await this.financeService.findEligibleForRelease();
      this.logger.log(`Found ${eligible.length} escrows eligible for release`);

      for (const balance of eligible) {
        await this.processRelease(balance);
      }

      span.setAttribute("escrows.processed", eligible.length);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error);
      this.logger.error("EscrowMonitorWorker failed", error);
    } finally {
      span.end();
    }
  }

  private async processRelease(balance: Balance): Promise<void> {
    try {
      // 1. Chama EscrowContract.release() on-chain (multi-sig via KMS)
      const { txHash } = await this.sorobanService.releaseEscrow(balance.sorobanEscrowId!);

      // 2. Transiciona no banco + ledger (dentro de $transaction)
      await this.financeService.releaseBalance(balance.id);

      // 3. Publica domain event para WebSocket push ao produtor
      await this.prisma.$transaction(async (tx) => {
        await this.outboxService.publish(tx, "balance.released", balance.id, {
          organizationId: balance.organizationId,
          eventId: balance.eventId,
          amountBrl: balance.amountBrlEquiv,
          txHash,
        });
      });

      this.logger.log(`Released balance ${balance.id} — tx: ${txHash}`);
    } catch (error) {
      // Falha em um não para os outros
      this.logger.error(`Failed to release balance ${balance.id}`, error);
      // Registra o erro mas não lança — o cron vai tentar novamente em 1 min
    }
  }
}
```

---

## 5. FinanceQueryService — CQRS read side

```typescript
@Injectable()
export class FinanceQueryService {
  private readonly CACHE_TTL = 30; // 30 segundos (atualizado por evento)

  // Retorna dashboard financeiro completo (Redis com fallback Postgres)
  async getDashboard(organizationId: string, eventId?: string): Promise<FinancialDashboard>;

  // Retorna histórico de transações paginado
  async getLedger(
    organizationId: string,
    options: { page: number; limit: number; eventId?: string },
  ): Promise<{ items: FinancialLedger[]; total: number }>;

  // Atualiza projeção no Redis (chamado pelo balance.released worker)
  async refreshDashboard(organizationId: string): Promise<void>;

  private getCacheKey(organizationId: string, eventId?: string): string {
    return eventId
      ? `finance:dashboard:${organizationId}:${eventId}`
      : `finance:dashboard:${organizationId}`;
  }
}
```

---

## 6. FinanceDashboardWorker — atualiza read model

```typescript
// Consome "balance.released", "payment.confirmed", "refund.issued", etc.
// Invalida e recalcula a projeção Redis do dashboard

@Processor("balance.released")
export class FinanceDashboardWorker extends WorkerHost {
  async process(job: Job<BalanceReleasedPayload>): Promise<void> {
    const { organizationId } = job.data;
    await this.financeQueryService.refreshDashboard(organizationId);

    // Push WebSocket para o produtor
    await this.redis.publish(
      `tenant:${organizationId}:producer`,
      JSON.stringify({ type: "balance.updated", payload: job.data }),
    );
  }
}
```

---

## 7. Endpoints

### GET /finance/dashboard
```
Auth: produtor
Query: eventId? (filtra por evento)
Response 200: FinancialDashboard
Cache: Redis 30s, invalidado por eventos financeiros
```

### GET /finance/ledger
```
Auth: produtor
Query: page=1, limit=20, eventId?
Response 200: { items: FinancialLedger[], total: number }
```

---

## 8. Testes esperados

### Unitários
- `FinanceService.releaseBalance` transiciona PENDING_SETTLEMENT → AVAILABLE
- `FinanceService.releaseBalance` registra entrada BALANCE_RELEASED no ledger
- `FinanceService.releaseBalance` publica domain event balance.released
- `FinanceService.findEligibleForRelease` retorna apenas balances com releaseAt no passado
- `EscrowMonitorWorker.processRelease` não lança erro se EscrowContract falha (log + continua)
- `FinanceQueryService.getDashboard` serve do Redis quando disponível

### Integração
- EscrowMonitorWorker libera saldo após `releaseAt` passado
- Dashboard atualizado no Redis após release
- Ledger nunca tem linhas deletadas ou alteradas

---

## 9. Definição de Pronto

- [ ] EscrowMonitorJob roda a cada 1 minuto
- [ ] Saldo transiciona automaticamente de PENDING para AVAILABLE após `releaseAt`
- [ ] Ledger financeiro é append-only (zero updates ou deletes)
- [ ] Dashboard do produtor serve do Redis
- [ ] WebSocket push ao produtor quando saldo fica disponível
- [ ] Todos os testes passam
