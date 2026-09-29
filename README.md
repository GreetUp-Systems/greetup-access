# GreetUp Access

> Plataforma de venda de ingressos, credenciamento e repasse financeiro para eventos corporativos B2B.

**Stack:** Stellar · Soroban · Privy · BlindPay · NestJS · Next.js 15 · PostgreSQL · BullMQ · Turborepo

---

## Estrutura do Monorepo

```
apps/
├── api/          # NestJS — API REST + WebSocket Gateway
├── web/          # Next.js 15 — frontend + PWA de credenciamento
└── workers/      # BullMQ workers isolados (MintWorker, CheckinWorker, etc.)

packages/
├── contracts/    # Rust + Soroban — TicketContract + EscrowContract
├── database/     # Prisma schema + migrations
├── shared/       # Tipos TypeScript compartilhados
└── config/       # ESLint, TSConfig base

docs/             # Documentação técnica completa
```

## Setup local

### Pré-requisitos

- Node.js >= 22
- pnpm >= 9
- Docker + Docker Compose
- Rust + wasm32-unknown-unknown target
- stellar-cli

```bash
# Instalar dependências
pnpm install

# Subir Postgres e Redis
docker compose up -d

# Variáveis de ambiente
cp .env.example .env
# Preencher os valores no .env

# Migrations do banco
pnpm db:migrate

# Seed de dados de desenvolvimento
pnpm db:seed

# Rodar todos os apps em modo dev
pnpm dev
```

### URLs em desenvolvimento

| Serviço | URL |
|---|---|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Redis Commander | http://localhost:8081 (perfil tools) |
| pgAdmin | http://localhost:5050 (perfil tools) |

```bash
# Com ferramentas de visualização
docker compose --profile tools up -d
```

## Testes

```bash
# Unitários
pnpm test

# Integração (sobe Postgres + Redis em Docker)
pnpm test:integration

# E2E (requer apps rodando)
pnpm test:e2e

# Contratos Soroban
cd packages/contracts && cargo test
```

## Build

```bash
# Build de todos os apps
pnpm build

# Build de um app específico
pnpm turbo build --filter=api
pnpm turbo build --filter=web

# Build do contrato Soroban
cd packages/contracts
stellar contract build --release
```

## Documentação

A documentação técnica completa está em [`docs/`](./docs/README.md), incluindo:

- [Visão do Produto](./docs/01-vision/product-vision.md)
- [Arquitetura C4](./docs/02-project/architecture-c4.md)
- [Modelo de Dados](./docs/02-project/data-model.md)
- [Contratos de Integração](./docs/02-project/integrations.md)
- [ADRs](./docs/03-adrs/) — decisões arquiteturais documentadas
- [Runbooks](./docs/04-runbooks/) — procedimentos operacionais

## Branches

| Branch | Ambiente | Deploy |
|---|---|---|
| `main` | Produção | Manual (2 aprovadores) |
| `staging` | Staging | Automático após CI |
| `develop` | DEV | Automático |
| `feat/*` | — | CI apenas |
| `contracts/*` | — | Pipeline própria |

## Variáveis de Ambiente

Ver [`.env.example`](./.env.example) para a lista completa de variáveis necessárias.

Secrets em produção gerenciados via **Doppler** + **AWS Secrets Manager**.  
Nunca commitar o `.env` com valores reais.

---

> **GreetUp-Corp/access-platform** · Confidencial
