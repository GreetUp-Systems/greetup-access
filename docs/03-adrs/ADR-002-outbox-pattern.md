# ADR-002 — Outbox Pattern para garantia de entrega de eventos

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

O sistema publica eventos de domínio em filas BullMQ após operações no banco. Se a app cair entre o commit e a publicação, o evento se perde — ingresso não é emitido, saldo não é atualizado.

## Opções Avaliadas

**Publicação direta após commit:** simples, mas perde evento se app cair entre as duas operações.

**CDC com Debezium + Kafka:** robusto mas complexidade desproporcional ao estágio atual.

**Transactional Outbox:** evento escrito na mesma transação do banco. Relay publica no BullMQ.

## Decisão

**Transactional Outbox Pattern** com tabela `domain_events` e relay com polling de 500ms.

## Justificativa

1. Atomicidade garantida — ou ambos (estado + evento) persistem, ou nenhum
2. Sem dependência de Kafka no MVP
3. Polling 500ms suficiente para o volume atual
4. Relay pausável sem perda — acumula no Postgres e reprocessa ao reiniciar

## Consequências

- Latência adicional de até 500ms (aceitável)
- Lock no relay para evitar publicação dupla com múltiplas réplicas
- Job de limpeza periódica de eventos PROCESSED
