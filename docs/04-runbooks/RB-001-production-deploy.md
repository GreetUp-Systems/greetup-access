# RB-001 — Deploy em Produção

**Objetivo:** executar deploy em produção com zero downtime e rollback seguro.

---

## Pré-requisitos

- [ ] Todos os testes passando na branch `staging`
- [ ] Smoke tests E2E passando no ambiente de staging
- [ ] Não há evento de cliente ocorrendo nas próximas 2 horas
- [ ] Dois revisores aprovaram o PR para `main`
- [ ] DLQ vazia (ou itens conhecidos e aceitos)
- [ ] Métricas de staging dentro do normal (erro rate < 1%, latência p99 < 300ms)

---

## Execução

### 1. Aprovar o workflow no GitHub Actions
Acessar `Actions > Deploy Production > Approve`.  
Requer aprovação de dois revisores configurados no GitHub Environment `production`.

### 2. Monitorar o deploy blue-green

```bash
# Acompanhar logs em tempo real no Railway
railway logs --service api --tail

# Verificar health check das réplicas green
curl https://api.greetup.com/health
# Esperado: { "status": "ok", "db": "ok", "redis": "ok" }
```

### 3. Período de canary (10% → 5 minutos)

Monitorar no Grafana:
- `error_rate{env="prod", service="api"}` — deve ficar < 1%
- `http_latency_p99{env="prod"}` — deve ficar < 500ms
- `bullmq_dlq_size` — deve ficar estável (não crescer)

Se qualquer métrica sair do threshold: **rollback imediato** (ver seção abaixo).

### 4. Cutover completo (100% → green)

Automático após 5 minutos sem anomalias.

### 5. Pós-deploy (30 minutos de observação)

- [ ] Verificar Sentry — sem novos erros críticos
- [ ] Verificar Grafana — métricas estáveis
- [ ] Testar fluxo de compra manual em produção (ingresso de teste)
- [ ] Confirmar que workers BullMQ estão processando normalmente

---

## Rollback

### Rollback automático (Cloudflare)
Se erro rate > 1% durante o canary, o Cloudflare reverte para 100% blue automaticamente.

### Rollback manual
```bash
# No Railway: selecionar deployment anterior e fazer redeploy
# Ou via GitHub Actions: workflow de rollback manual

# Verificar que blue ainda está em standby (30 min após cutover)
railway status --service api
```

---

## Deploy de Workers (separado da API)

Workers têm deploy independente. O mesmo processo, mas com atenção ao graceful shutdown:

```bash
# Verificar que não há jobs em processamento antes do deploy
# Railway drena automaticamente com SIGTERM (30s timeout)
railway logs --service workers --tail
```

---

## Deploy de Contratos Soroban (processo separado e mais cuidadoso)

Ver [RB-007 — Migração de Contrato Soroban](./RB-007-soroban-migration.md).
