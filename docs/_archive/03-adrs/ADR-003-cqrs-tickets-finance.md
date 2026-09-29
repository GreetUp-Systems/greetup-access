# ADR-003 — CQRS nos domínios de Tickets e Finance

**Status:** ⛔ **Superado em 20/08/2026** — ver [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md), D-16
**Status original:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

> ## Por que foi superado
>
> O dimensionamento estava errado. Este ADR justifica CQRS com "dashboard de evento com 5.000
> pessoas", mas os eventos piloto têm de 25 a 500 participantes — Postgres com índice resolve isso
> com folga. A disparidade de leitura/escrita que motivaria CQRS não existe no volume real.
>
> Pesou também o risco: CQRS dobra o número de modelos por domínio, e num sistema que mexe com
> dinheiro uma invalidação de cache errada vira saldo errado na tela do produtor. Risco concreto em
> troca de ganho hipotético.
>
> **Decisão vigente:** sem cache e sem CQRS. Redis fica só para o BullMQ. Quando um query real
> doer, põe-se cache naquele query — o que é reversível, ao contrário de CQRS.
>
> O raciocínio abaixo fica preservado como registro.

---

## Contexto

Tickets: 1 escrita por compra; N leituras por comprador verificando QR Code. Finance: poucas escritas; muitas leituras do dashboard. CQRS resolve a disparidade de carga sem prejudicar a consistência das escritas.

## Decisão

Aplicar **CQRS** em Tickets e Finance. Não aplicar em Events CRUD, Auth, Organizations, Notifications (baixo volume, CRUD simples).

**Write side:** Postgres, consistência forte, ACID, via BullMQ worker.

**Read side:** Redis (projeção denormalizada), TTL configurável, atualizada por evento, fallback para Postgres em cache miss.

## Justificativa

1. Dashboard de evento com 5.000 pessoas: N compradores simultâneos — Redis responde em < 5ms
2. Dashboard financeiro: query de saldo sem CQRS = 8+ JOINs — projeção Redis é JSON pré-calculado
3. Ledger append-only: CQRS natural — todo saldo derivado da sequência de eventos

## Consequências

- Consistência eventual no read side: até 500ms de delay (aceitável)
- Invalidação de cache deve ser cuidadosa — worker atualiza projeção após cada escrita bem-sucedida
- Mais código — dois modelos por domínio
