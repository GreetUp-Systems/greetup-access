# ADR-005 — Row-Level Security para isolamento de tenants

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

Sistema multi-tenant: múltiplos produtores com dados completamente isolados. Opções: schema por tenant, banco por tenant, RLS no schema compartilhado.

## Decisão

**RLS (Row-Level Security)** no PostgreSQL 16, schema compartilhado.

## Implementação

```sql
-- Interceptor NestJS seta antes de cada query
SELECT set_config('app.current_organization_id', $orgId, true);

-- Policy aplicada automaticamente em toda query
CREATE POLICY tenant_isolation ON events
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

## Justificativa

1. Isolamento garantido pelo banco — mesmo se o código esquecer o filtro, RLS protege
2. Operação simples — uma migration, um banco, monitoramento centralizado
3. Escala para centenas de tenants sem overhead operacional
4. Zero risco de leak entre tenants

## Consequências

- Performance: overhead < 1ms por query (benchmarks Postgres 16)
- Interceptor NestJS precisa rodar antes de toda query — testar rigorosamente
- Migrations rodam com super-user (bypass RLS) — atenção em scripts de seed
