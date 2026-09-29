# RB-004 — Incidente durante Evento ao Vivo

**Objetivo:** triagem e mitigação rápida de problemas durante um evento com participantes presentes.

**Prioridade:** máxima — cada minuto impacta centenas de pessoas na entrada.

---

## Contatos de emergência

| Papel | Contato |
|---|---|
| Tech Lead | Matheus Aguiar — [número] |
| Suporte BlindPay | [canal de suporte BlindPay] |
| Suporte Railway | [status.railway.com] |
| Suporte Stellar | [Discord Stellar Dev] |

---

## Cenário 1 — Credenciamento offline não funciona

**Sintoma:** staff não consegue validar QR Codes, app travado ou sem resposta.

```bash
# 1. Verificar se o snapshot foi sincronizado antes do evento
# Perguntar ao staff: o app mostrou "X tickets carregados" antes do início?

# 2. Se sim — problema no app local
# Solução: forçar reload do PWA (Ctrl+F5 ou limpar cache)
# Fallback: usar lista impressa de nomes + CPF

# 3. Se não — snapshot não foi baixado
# Conectar ao Wi-Fi do local e sincronizar manualmente
# POST /events/:id/ticket-snapshot (gera novo snapshot)
```

**Fallback de emergência:** lista impressa de compradores exportada do dashboard antes do evento.

---

## Cenário 2 — API fora do ar (compras não funcionam)

**Sintoma:** compradores não conseguem pagar, QR Code Pix não gera.

```bash
# 1. Verificar status do Railway
open https://status.railway.com

# 2. Verificar health check
curl https://api.greetup.com/health

# 3. Se pods estão down — fazer redeploy
railway redeploy --service api

# 4. Verificar se o problema é no BlindPay
open https://status.blindpay.com

# 5. Se BlindPay está down — ver RB-005
```

**Comunicação:** notificar o produtor imediatamente. Postar status em status.greetup.com.

---

## Cenário 3 — Tickets não sendo emitidos (mints falhando)

**Sintoma:** comprador pagou mas não recebeu o ingresso.

```bash
# 1. Verificar DLQ do MintWorker
# Ver RB-003 para procedimento completo

# 2. Verificar saldo da conta patrocinadora (D-02)
stellar account info --account ${STELLAR_SPONSOR_ADDRESS}
# Se não houver XLM livre para novas reservas: recarregar a conta patrocinadora
# Verificar também status e saldo do OpenZeppelin Relayer

# 3. Verificar se Stellar Horizon está respondendo
curl https://horizon.stellar.org/
```

**Para o comprador:** enviar ingresso manualmente via painel admin enquanto o issue é resolvido.

---

## Cenário 4 — Check-ins duplicados aparecendo no dashboard

**Sintoma:** contador de presença acima do esperado, mesmo participante contado múltiplas vezes.

```bash
# Verificar conflitos de check-in no banco
psql $DATABASE_URL -c "
  SELECT ticket_id, COUNT(*) as count
  FROM checkin_events
  WHERE event_id = '$eventId'
  GROUP BY ticket_id
  HAVING COUNT(*) > 1
"

# Conflitos de sync offline são esperados e tratados pelo sistema
# O contrato Soroban rejeita duplicatas — o dashboard deve mostrar is_conflict = true
```

**Ação:** conflitos on-chain são inofensivos — o contrato garante que só um check-in vale.

---

## Comunicação durante incidente

1. Notificar produtor imediatamente via WhatsApp/Telegram
2. Atualizar status.greetup.com (se disponível)
3. Log do incidente: hora, sintoma, ação tomada, resultado
4. Post-mortem em até 48h após o evento
