# ADR-007 — Railway como plataforma de deploy no MVP

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

Precisamos de plataforma para: múltiplos serviços (API, workers, cron, Postgres, Redis), blue-green deploy, health checks, graceful shutdown, custo controlado.

## Decisão

**Railway Pro plan** como plataforma principal no MVP.

## Justificativa

1. Menor overhead operacional — git push deploya, sem gerenciar Kubernetes
2. Suporta todos os serviços necessários com managed Postgres e Redis
3. Blue-green nativo, health checks a cada 10s, graceful shutdown com SIGTERM
4. Custo ~$83/mês no MVP vs complexidade de AWS ECS
5. HPA baseado em CPU suficiente para o volume projetado

## Consequências

- Teto natural de escala em centenas de req/s sustentados — migrar para AWS ECS/Fargate quando necessário
- Lock-in nas referências de serviço — abstrair via variáveis de ambiente
- Migração é projeto de infraestrutura, não de produto
