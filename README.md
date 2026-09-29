# Access

> Plataforma de venda de ingressos, controle de entrada e recebimento para eventos.

O projeto evolui por Spec-Driven Development. A fundação de backend está concluída; integrações de
produto com Privy, BlindPay e Stellar serão adicionadas somente nas SPECs correspondentes.

## Estado atual

Implementado na [`SPEC-001 — Foundation v2`](./docs/06-sdd/SPEC-001-foundation.md):

- monorepo pnpm + Turborepo;
- API NestJS e processo independente de workers;
- PostgreSQL 16, Prisma e migration inicial do Outbox;
- Redis 7 com política `noeviction`;
- configuração validada no startup;
- liveness, readiness, testes unitários e testes de integração.

`apps/web` e `packages/contracts` estão reservados para etapas futuras e ainda não fazem parte do
runtime.

## Estrutura

```text
apps/
├── api/          # API NestJS
├── web/          # reservado para o frontend
└── workers/      # processo NestJS standalone

packages/
├── config/       # schemas e carregamento de configuração
├── contracts/    # reservado para contratos Stellar
├── database/     # Prisma, migration e acesso ao PostgreSQL
├── redis/        # cliente Redis compartilhado
└── shared/       # tipos e utilitários sem dependência de infraestrutura
```

## Setup local

Pré-requisitos:

- Node.js 22 ou superior;
- pnpm 9;
- Docker com Docker Compose.

```bash
pnpm install --frozen-lockfile
pnpm env:init
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

O comando `pnpm env:init` cria `.env` a partir de `.env.example` sem sobrescrever um arquivo já
existente.

### Endpoints locais

| Endpoint | Finalidade |
|---|---|
| `GET http://localhost:3001/api/health/live` | Confirma que o processo da API está vivo |
| `GET http://localhost:3001/api/health/ready` | Confirma acesso ao PostgreSQL e Redis |

Ferramentas opcionais de desenvolvimento:

```bash
docker compose --profile tools up -d
```

- Redis Commander: http://localhost:8081
- pgAdmin: http://localhost:5050

## Qualidade

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
```

Os testes de integração usam PostgreSQL e Redis reais definidos em `docker-compose.test.yml`.

## Documentação e contexto para agentes

- [Índice da documentação](./docs/README.md)
- [Fonte de verdade arquitetural](./docs/06-sdd/MVP-REVISADO.md)
- [Visão e status das SPECs](./docs/06-sdd/OVERVIEW.md)
- [Ferramentas de desenvolvimento e skills](./docs/02-project/development-tooling.md)

As skills instaladas no escopo do projeto ficam em `.agents/skills`, com origem e hashes registrados
em `skills-lock.json`. Credenciais e configurações MCP do usuário não são versionadas.

## Branches

| Branch | Papel |
|---|---|
| `main` | versão estável |
| `develop` | integração de desenvolvimento |
| `feat/*` | mudanças de produto ou infraestrutura |

Nunca faça commit de `.env`, chaves privadas ou credenciais de integrações.
