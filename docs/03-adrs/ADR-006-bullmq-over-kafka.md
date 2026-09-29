# ADR-006 — BullMQ sobre Kafka para mensageria

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

O sistema precisa de mensageria robusta para mints, check-ins, payouts e monitoramento de escrow.

## Decisão

**BullMQ sobre Redis Streams.**

## Justificativa

1. Redis já está no stack — sem serviço adicional
2. BullMQ oferece: retry exponencial, DLQ, prioridade, delay, cron, concorrência — tudo necessário
3. Kafka requereria cluster separado, partições, consumer offsets, schema registry — desproporcional ao volume atual
4. Volume estimado: centenas de eventos/hora no MVP — longe do limite do BullMQ
5. Migração para Kafka é projeto definido quando volume justificar

## Consequências

- Redis como dependency para filas — mitigado com Redis Sentinel (HA)
- Sem exactly-once nativo — mitigado com idempotência em todos os consumers
- Escala horizontal: adicionar pods Railway sem mudança de infraestrutura
