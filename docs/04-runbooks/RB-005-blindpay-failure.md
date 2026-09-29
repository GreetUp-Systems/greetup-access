# RB-005 — Falha do BlindPay

**Objetivo:** gerenciar indisponibilidade do BlindPay sem perda de dados ou inconsistência financeira.

---

## Monitoramento

```bash
# Alerta automático: BlindPay API retornando 5xx por > 3 requisições consecutivas
# Prometheus: blindpay_api_errors_total > threshold

# Verificar status oficial
open https://status.blindpay.com
```

---

## Impacto por tipo de operação

| Operação | Impacto | Ação |
|---|---|---|
| Payin (Pix do comprador) | Comprador não consegue pagar | Fila BullMQ acumula; processa quando BlindPay voltar |
| Webhook (confirmação de pagamento) | Ingresso não emitido | BlindPay reenviar webhook quando voltar; idempotência garante segurança |
| Payout (retirada do produtor) | Retirada não processada | Estado withdraw_payout_sent persiste; PayoutRecoveryWorker retenta |
| KYB (onboarding do produtor) | Onboarding travado | Informar produtor, aguardar retorno do BlindPay |

---

## Durante a indisponibilidade

### Novos pagamentos
- Exibir mensagem de manutenção na página de evento: "Pagamentos temporariamente indisponíveis"
- Feature flag para desabilitar o fluxo de compra: `DISABLE_NEW_PAYMENTS=true`
- **Não perder dados:** purchases em status `initiated` ficam no banco

### Payouts em andamento
- Não fazer rollback manual — estado no banco e on-chain é a fonte de verdade
- `PayoutRecoveryWorker` retenta automaticamente a cada 5 minutos

---

## Após retorno do BlindPay

```bash
# 1. Verificar DLQ de payin e payout
# Ver RB-003

# 2. Reprocessar payins pendentes com idempotency_key
# O BlindPay responde idempotentemente — seguro reprocessar

# 3. Verificar payouts em withdraw_payout_sent há > 10 min
psql $DATABASE_URL -c "
  SELECT id, status, updated_at
  FROM withdrawals
  WHERE status = 'WITHDRAW_PAYOUT_SENT'
  AND updated_at < NOW() - INTERVAL '10 minutes'
"
# PayoutRecoveryWorker já deve ter detectado e retentado automaticamente

# 4. Reabilitar novos pagamentos
# Remover feature flag DISABLE_NEW_PAYMENTS
```

---

## Comunicação

- Produtores com vendas ativas: notificar via email que pagamentos serão processados normalmente após retorno
- Produtores com retirada pendente: notificar que a retirada será processada automaticamente
