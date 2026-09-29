# RB-002 — Comprometimento de Chave KMS

**Objetivo:** conter, avaliar e recuperar de um possível vazamento de chave criptográfica.

**Tempo de resposta esperado:** contenção < 5 min, avaliação < 30 min.

---

## Sinais de comprometimento

- CloudTrail mostra uso da chave em horário ou origem inesperada
- Alerta Prometheus: `kms_unusual_sign_requests`
- Transação Soroban não autorizada detectada pelo monitoramento on-chain
- Release de escrow fora do fluxo normal

---

## 1. Identificação (< 1 minuto)

```bash
# Verificar últimas chamadas à chave no CloudTrail
aws cloudtrail lookup-events   --lookup-attributes AttributeKey=ResourceName,AttributeValue=${KMS_KEY_ID}   --start-time $(date -d '1 hour ago' --iso-8601=seconds)

# Verificar transações recentes no Soroban
stellar tx list --contract ${SOROBAN_ESCROW_CONTRACT_ADDRESS} --limit 20
```

---

## 2. Contenção (< 5 minutos)

```bash
# PASSO 1: Pausar o contrato Soroban (impede qualquer release ou block)
# Requer multi-sig 2-of-3 — contato imediato com cofundador para Signer B
stellar contract invoke   --id ${SOROBAN_ESCROW_CONTRACT_ADDRESS}   --fn pause   --source ${SIGNER_A_KEYPAIR}   -- --signatures "[signer_a_sig, signer_b_sig]"

# PASSO 2: Desabilitar a chave comprometida no KMS
aws kms disable-key --key-id ${KMS_KEY_ID}

# PASSO 3: Revogar tokens de acesso dos pods que usavam a chave
# Railway: fazer redeploy de todos os serviços (gera novos tokens OIDC)
railway redeploy --service api
railway redeploy --service workers
```

---

## 3. Avaliação (< 30 minutos)

```bash
# Auditar todas as transações do contrato desde o último uso legítimo
stellar tx list --contract ${SOROBAN_TICKET_CONTRACT_ADDRESS} --after ${LAST_LEGITIMATE_TX}
stellar tx list --contract ${SOROBAN_ESCROW_CONTRACT_ADDRESS} --after ${LAST_LEGITIMATE_TX}

# Verificar saldos de todos os escrows ativos
# Comparar com o ledger financeiro no Postgres
psql $DATABASE_URL -c "SELECT * FROM balances WHERE status != 'withdrawn' ORDER BY created_at DESC"
```

Perguntas a responder:
- Algum release indevido ocorreu?
- Qual é o vetor de comprometimento?
- Quais outros sistemas podem ter sido afetados?

---

## 4. Recuperação

```bash
# Gerar nova keypair no KMS
aws kms create-key --description "greetup-treasury-v2" --key-usage SIGN_VERIFY

# Atualizar o contrato para aceitar a nova chave (multi-sig 2-of-3)
stellar contract invoke   --id ${SOROBAN_ESCROW_CONTRACT_ADDRESS}   --fn update_signer   -- --old_signer ${OLD_KMS_ADDRESS} --new_signer ${NEW_KMS_ADDRESS}   --signatures "[signer_b_sig, signer_c_sig]"

# Período de transição: contrato aceita ambas as chaves por 24h
# Após validação da nova chave:
aws kms schedule-key-deletion --key-id ${OLD_KMS_KEY_ID} --pending-window-in-days 7

# Despausar o contrato
stellar contract invoke --fn unpause -- --signatures "[signer_a_sig, signer_b_sig]"
```

---

## 5. Post-mortem

- [ ] Documentar causa raiz
- [ ] Notificar produtores afetados (se houver)
- [ ] Implementar controle adicional para evitar repetição
- [ ] Atualizar este runbook com lições aprendidas
