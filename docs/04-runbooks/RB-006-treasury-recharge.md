# RB-006 — Recarga da Conta Treasury Stellar

**Objetivo:** recarregar o XLM da conta Treasury sem downtime, garantindo continuidade dos mints.

**Trigger:** alerta Prometheus `stellar_treasury_xlm_balance < 50`

---

## Por que o Treasury precisa de XLM

A conta Treasury paga:
- **Fee-bump** de todas as transações dos compradores (sem gas para o usuário)
- **Ativação** de novas wallets Stellar (mínimo 1 XLM por wallet)
- **Trustlines** USDC para compradores (0.5 XLM por trustline)

Cálculo de consumo aproximado:
- Evento de 500 pessoas: ~1.500 transações × $0.00001 = $0.015 em gas + 500 wallets novas × $0.15 XLM ≈ $75 de XLM total
- Manter mínimo de 200 XLM em produção

---

## 1. Verificar saldo atual

```bash
stellar account info --account ${TREASURY_STELLAR_ADDRESS} --network mainnet
# Campo: balances[].balance onde asset_type = "native" (XLM)
```

---

## 2. Calcular recarga necessária

```bash
# Verificar eventos ativos e compradores esperados
psql $DATABASE_URL -c "
  SELECT e.name, e.capacity_max, e.event_date,
    COUNT(t.id) as tickets_sold
  FROM events e
  LEFT JOIN tickets t ON t.event_id = e.id
  WHERE e.status = 'published' AND e.event_date > NOW()
  GROUP BY e.id
  ORDER BY e.event_date
"

# Estimativa: (tickets_pendentes × 0.15 XLM) + buffer de 100 XLM
```

---

## 3. Executar recarga

A recarga pode ser feita de três formas:

**Opção A — Via exchange centralizada (mais rápida)**
1. Acessar Binance, Coinbase ou similar
2. Comprar XLM e enviar para `${TREASURY_STELLAR_ADDRESS}`
3. Verificar chegada em 3–5 segundos no Stellar

**Opção B — Via BlindPay off-ramp reverso**
- Usar saldo USDC da plataforma para comprar XLM (se disponível)

**Opção C — Via conta pessoal**
- Transferir XLM de wallet pessoal para Treasury
- Rápido, mas expõe a conexão entre contas pessoais e Treasury

---

## 4. Verificar após recarga

```bash
stellar account info --account ${TREASURY_STELLAR_ADDRESS} --network mainnet
# Confirmar que saldo está acima do mínimo de 200 XLM

# Testar mint de um ingresso de teste
# POST /admin/test/mint-ticket (endpoint de teste, protegido por auth)
```

---

## 5. Configurar alerta preventivo

O alerta deve disparar com antecedência suficiente:
- `stellar_treasury_xlm_balance < 200` → warning (recarregar em breve)
- `stellar_treasury_xlm_balance < 50` → critical (recarregar agora)
- `stellar_treasury_xlm_balance < 10` → página de manutenção habilitada automaticamente
