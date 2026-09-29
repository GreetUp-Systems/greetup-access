# SPEC-011 — Withdrawal (Retirada + Lock Redis + Payout BlindPay + Recovery)

**Objetivo:** Implementar o fluxo completo de retirada do produtor: lock distribuído Redis, release on-chain, payout BlindPay, monitoramento e recovery automático de falhas.

**Pré-requisitos:** SPEC-010

**Tempo estimado:** 2 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── withdrawals/
│   ├── withdrawals.module.ts
│   ├── withdrawals.controller.ts
│   ├── withdrawals.service.ts
│   └── __tests__/
│       ├── withdrawals.service.spec.ts
│       └── withdrawals.integration.spec.ts

apps/workers/src/
├── payout/
│   ├── payout.module.ts
│   ├── payout.worker.ts             ← processa "payout.initiated"
│   └── payout-recovery.worker.ts    ← cron a cada 5 min
```

---

## 2. WithdrawalsService — estados e fluxo

```
WITHDRAW_REQUESTED
    → WITHDRAW_ESCROW_DONE    (release on-chain executado)
    → WITHDRAW_PAYOUT_SENT    (BlindPay payout iniciado)
    → WITHDRAWN               (webhook payout.completed recebido)
    → WITHDRAW_FAILED         (após recovery exaurir tentativas)
```

```typescript
@Injectable()
export class WithdrawalsService {
  // Fluxo principal — executado quando produtor clica "Solicitar Retirada"
  async initiate(
    dto: InitiateWithdrawalDto,
    organizationId: string,
  ): Promise<Withdrawal>;

  // Passo 1: adquire lock e valida saldo
  private async acquireLockAndValidate(
    organizationId: string,
    amountUsdc: number,
  ): Promise<{ lockToken: string; balance: Balance }>;

  // Passo 2: release on-chain (EscrowContract.release com multi-sig)
  private async executeEscrowRelease(withdrawal: Withdrawal): Promise<string>; // txHash

  // Passo 3: inicia payout no BlindPay
  private async initiatePayout(withdrawal: Withdrawal): Promise<string>; // payoutId

  // Confirma payout — chamado pelo webhook handler
  async confirmPayout(blindpayPayoutId: string): Promise<void>;

  // Lista histórico de retiradas
  async findByOrganization(
    organizationId: string,
    options: { page: number; limit: number },
  ): Promise<{ items: Withdrawal[]; total: number }>;
}
```

---

## 3. Implementação detalhada do fluxo

```typescript
async initiate(dto: InitiateWithdrawalDto, organizationId: string): Promise<Withdrawal> {
  // 1. Verifica se há retirada em andamento (evita duplicatas sem lock)
  const pending = await this.prisma.withdrawal.findFirst({
    where: {
      organizationId,
      status: {
        in: [
          WithdrawalStatus.WITHDRAW_REQUESTED,
          WithdrawalStatus.WITHDRAW_ESCROW_DONE,
          WithdrawalStatus.WITHDRAW_PAYOUT_SENT,
        ],
      },
    },
  });
  if (pending) throw new ConflictException("Withdrawal already in progress");

  // 2. Adquire lock Redis (TTL: 5 minutos)
  const lockKey = `withdrawal:lock:${organizationId}`;
  const lockToken = await this.redisLock.acquire(lockKey, 300_000);
  if (!lockToken) throw new ConflictException("Could not acquire withdrawal lock");

  try {
    // 3. Valida saldo disponível
    const available = await this.financeService.getAvailableBalance(organizationId);
    if (available.amountUsdc < dto.amountUsdc) {
      throw new BadRequestException("Insufficient available balance");
    }

    // 4. Cria Withdrawal no banco
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.create({
        data: {
          organizationId,
          balanceId: available.balanceId,
          amountUsdc: dto.amountUsdc,
          amountBrl: dto.amountBrl,
          pixKey: dto.pixKey,
          status: WithdrawalStatus.WITHDRAW_REQUESTED,
        },
      });
      await this.outboxService.publish(tx, "withdrawal.initiated", w.id, {
        withdrawalId: w.id, organizationId, amountUsdc: dto.amountUsdc,
      });
      return w;
    });

    // 5. Release on-chain (sincronamente — crítico)
    const txHash = await this.executeEscrowRelease(withdrawal);
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: WithdrawalStatus.WITHDRAW_ESCROW_DONE, stellarTxHash: txHash },
    });

    // 6. Payout BlindPay
    const payoutId = await this.initiatePayout(withdrawal);
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: WithdrawalStatus.WITHDRAW_PAYOUT_SENT, blindpayPayoutId: payoutId },
    });

    return withdrawal;
  } finally {
    // Sempre libera o lock — mesmo em caso de erro
    await this.redisLock.release(lockKey, lockToken);
  }
}
```

---

## 4. PayoutRecoveryWorker — cron a cada 5 minutos

```typescript
@Injectable()
export class PayoutRecoveryWorker implements OnModuleInit {
  // Detecta retiradas em WITHDRAW_ESCROW_DONE há mais de 10 minutos
  // Retenta APENAS o payout BlindPay (não re-executa o release on-chain)

  async run(): Promise<void> {
    const staleWithdrawals = await this.prisma.withdrawal.findMany({
      where: {
        status: WithdrawalStatus.WITHDRAW_ESCROW_DONE,
        updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }, // 10 min atrás
      },
    });

    for (const withdrawal of staleWithdrawals) {
      try {
        const payoutId = await this.blindPayService.executePayout(
          withdrawal.id,
          withdrawal.pixKey!,
        );
        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WithdrawalStatus.WITHDRAW_PAYOUT_SENT,
            blindpayPayoutId: payoutId,
          },
        });
        this.logger.log(`Recovery: initiated payout for withdrawal ${withdrawal.id}`);
      } catch (error) {
        this.logger.error(`Recovery failed for withdrawal ${withdrawal.id}`, error);
      }
    }
  }
}
```

---

## 5. Endpoints

### POST /withdrawals
```
Auth: produtor com saldo disponível > 0
Body: {
  amountUsdc: number,
  amountBrl: number,     // valor calculado pelo frontend
  pixKey: string,        // chave Pix de destino
}
Response 201: Withdrawal
Erros:
  400 — saldo insuficiente
  409 — retirada já em andamento
  423 — lock não adquirido (retry após 1s)
```

### GET /withdrawals
```
Auth: produtor
Query: page=1, limit=20
Response 200: { items: Withdrawal[], total: number }
```

### GET /withdrawals/:id
```
Auth: produtor owner
Response 200: Withdrawal com status atual
```

---

## 6. Testes esperados

### Unitários
- `WithdrawalsService.initiate` adquire lock Redis antes de processar
- `WithdrawalsService.initiate` libera lock em caso de erro (finally)
- `WithdrawalsService.initiate` lança ConflictException se retirada em andamento
- `WithdrawalsService.initiate` lança BadRequestException se saldo insuficiente
- `WithdrawalsService.confirmPayout` transiciona para WITHDRAWN
- `PayoutRecoveryWorker.run` retenta payout de withdrawal em WITHDRAW_ESCROW_DONE > 10min
- `PayoutRecoveryWorker.run` não re-executa release on-chain (apenas payout)

### Integração
- Fluxo completo: initiate → escrow_done → payout_sent → withdrawn (webhook mock)
- Segundo `POST /withdrawals` enquanto há uma em andamento retorna 409
- Recovery detecta withdrawal parado em WITHDRAW_ESCROW_DONE

---

## 7. Definição de Pronto

- [ ] Retirada não pode ser iniciada com retirada em andamento
- [ ] Lock Redis liberado mesmo em caso de falha
- [ ] Release on-chain executado antes do payout BlindPay
- [ ] PayoutRecoveryWorker retenta payout automaticamente após 10min
- [ ] Webhook payout.completed transiciona para WITHDRAWN
- [ ] Todos os testes passam
