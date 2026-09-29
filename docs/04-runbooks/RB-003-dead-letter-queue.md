# RB-003 — Jobs na Dead-Letter Queue

**Objetivo:** inspecionar, diagnosticar e reprocessar jobs que falharam após todas as tentativas.

---

## Quando agir

- Alerta Prometheus: `bullmq_dlq_size{queue="X"} > 0`
- Comprador reportou que não recebeu ingresso após pagar
- Produtor reportou que retirada não foi processada

---

## 1. Inspecionar a DLQ

```typescript
// Via script de administração ou painel interno

import { Queue } from 'bullmq';

const queue = new Queue('payment.confirmed', { connection: redisConfig });
const failedJobs = await queue.getFailed(0, 50);

for (const job of failedJobs) {
  console.log({
    id: job.id,
    name: job.name,
    data: job.data,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: new Date(job.timestamp),
  });
}
```

---

## 2. Classificar o tipo de falha

| Tipo de erro | Ação |
|---|---|
| `ECONNRESET`, `ETIMEDOUT` — problema de rede | Reprocessar — o problema pode ter passado |
| `tx_bad_seq` — sequência Stellar | Reprocessar — worker busca sequence atualizado |
| `HostError` — erro do contrato Soroban | Investigar antes de reprocessar — pode ser bug |
| `BlindPayError` — API BlindPay | Verificar status do BlindPay, reprocessar após confirmação |
| `DuplicateKeyError` — idempotência violada | Ignorar — o job já foi processado por outra instância |
| `InsufficientFunds` — conta patrocinadora ou Relayer sem XLM | Verificar o saldo de `STELLAR_SPONSOR_ADDRESS` e do OpenZeppelin Relayer, recarregar e só então reprocessar |

---

## 3. Reprocessar jobs

```typescript
// Reprocessar um job específico
const job = await queue.getJob(jobId);
await job.retry();

// Reprocessar todos os jobs falhados de uma fila
const failedJobs = await queue.getFailed(0, 100);
for (const job of failedJobs) {
  await job.retry();
}

// Via painel interno (preferível para rastreabilidade)
// POST /admin/dlq/:queue/retry-all
// POST /admin/dlq/:queue/retry/:jobId
```

---

## 4. Verificar resultado

```bash
# Confirmar que o ingresso foi emitido (para MintTicketJob)
psql $DATABASE_URL -c "SELECT status FROM purchases WHERE id = '$purchaseId'"
# Esperado: ticket_issued

# Confirmar on-chain
stellar contract invoke   --id ${SOROBAN_TICKET_CONTRACT_ADDRESS}   --fn get_ticket   -- --ticket_id "$ticketId"
```

---

## 5. Após reprocessamento

- [ ] Documentar causa raiz no log de incidentes
- [ ] Se falha sistêmica: criar issue no repositório com label `bug/infra`
- [ ] Verificar se outros jobs da mesma fila podem ser afetados
