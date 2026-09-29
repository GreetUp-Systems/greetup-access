# ADR-005 — Row-Level Security para isolamento de produtores

> **Status:** aceito, revisado pelo ADR-009
>
> **Data original:** 25/06/2026
>
> **Revisado em:** 29/09/2026

## Contexto

Dados de eventos, vendas e finanças de um produtor não podem ser lidos ou alterados por outro. O
ADR-009 simplificou o tenant do MVP: cada `ProducerProfile` pertence a exatamente um `User`, sem
`Organization` ou `Membership`.

O desenho anterior sugeria executar `SET LOCAL` em um interceptor e depois fazer queries Prisma
independentes. Isso não garante isolamento, porque o contexto e as queries podem usar conexões
diferentes do pool.

## Decisão

Usar PostgreSQL Row-Level Security nas tabelas pertencentes ao produtor, identificadas por
`producer_id`.

O contexto RLS deve ser configurado e consumido dentro da mesma transação Prisma:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`
    SELECT set_config('app.current_producer_id', ${producerId}, true)
  `;

  return operation(tx);
});
```

As policies usam o contexto transacional:

```sql
CREATE POLICY producer_isolation ON events
  USING (
    producer_id = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  )
  WITH CHECK (
    producer_id = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  );
```

## Regras de aplicação

- O `producerId` é resolvido no backend a partir do `User.id` autenticado.
- Um `producerId` recebido do cliente nunca se torna contexto RLS sem verificação de propriedade.
- Toda operação protegida recebe o cliente transacional `tx`; não pode escapar para o Prisma global.
- A policy usa `USING` e `WITH CHECK` para proteger leitura e escrita.
- A role de runtime da API não possui `BYPASSRLS`.
- Tabelas protegidas usam `FORCE ROW LEVEL SECURITY` quando aplicável.
- Jobs de workers carregam explicitamente o produtor do evento e executam sob o mesmo helper
  transacional.
- Ausência de contexto resulta em zero linhas visíveis, não em acesso irrestrito.

## Escopo temporal

A SPEC-002 define identidade e wallet, mas ainda não cria tabelas pertencentes ao produtor. A
implementação do helper transacional, das roles e da primeira policy RLS acontece na SPEC-003 junto
com `ProducerProfile` e o onboarding do produtor.

## Consequências

### Positivas

- uma query sem filtro explícito continua isolada pelo banco;
- leitura e escrita compartilham o mesmo contexto verificado;
- o modelo acompanha a regra de um produtor por conta sem impedir evolução futura.

### Custos

- serviços protegidos precisam executar dentro de callback transacional;
- testes de integração devem usar a role real de runtime, não o usuário de migration;
- operações administrativas sem tenant exigem conexão e autorização separadas;
- adicionar equipes no futuro exigirá alterar a resolução do produtor, embora as policies possam
  continuar usando `producer_id`.
