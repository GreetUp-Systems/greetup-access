# SPEC-001 — Foundation v2

> **Status:** implementada e validada
>
> **Versão:** 2.0
>
> **Atualizada em:** 29/09/2026
>
> **Fonte arquitetural:** [`MVP-REVISADO.md`](./MVP-REVISADO.md)

## 1. Objetivo

Entregar a menor fundação técnica capaz de sustentar as próximas SPECs do Access com segurança e
reprodutibilidade.

Ao final desta SPEC, o repositório deve instalar, compilar, subir a infraestrutura local, executar
a API e o processo de workers, aplicar uma migration inicial e passar por testes unitários e de
integração.

Esta SPEC não implementa nenhum fluxo de produto.

## 2. Resultado esperado

Uma pessoa deve conseguir clonar o repositório e, sem conhecimento prévio do projeto:

1. instalar as dependências com pnpm;
2. subir PostgreSQL e Redis via Docker Compose;
3. aplicar as migrations;
4. iniciar a API e o processo de workers;
5. consultar liveness e readiness;
6. executar build, lint, typecheck e testes pelos comandos da raiz.

## 3. Estado inicial

No início desta SPEC:

- a raiz já contém a configuração preliminar de pnpm, Turborepo, TypeScript e Docker Compose;
- `apps/api`, `apps/web`, `apps/workers` e os packages contêm apenas placeholders;
- não existe `pnpm-lock.yaml`;
- não existe código de aplicação nem schema Prisma implementado;
- a antiga SPEC-001 contém modelos financeiros e de domínio que não correspondem ao
  `MVP-REVISADO.md`.

## 4. Escopo

### 4.1 Incluído

- workspace pnpm e pipeline Turborepo funcional;
- aplicação NestJS mínima em `apps/api`;
- processo NestJS standalone mínimo em `apps/workers`;
- packages `config`, `database`, `redis` e `shared`;
- validação tipada das variáveis de ambiente da fundação;
- conexão com PostgreSQL por Prisma;
- conexão com Redis preparada para uso posterior pelo BullMQ;
- migration inicial contendo somente a infraestrutura do Outbox;
- endpoints separados de liveness e readiness;
- encerramento gracioso da API, Prisma, Redis e workers;
- testes unitários e de integração com PostgreSQL e Redis reais;
- geração e versionamento de `pnpm-lock.yaml`;
- inicialização idempotente de `.env` a partir de `.env.example`;
- atualização de `.env.example` apenas com as variáveis usadas nesta etapa.

### 4.2 Fora do escopo

- frontend em `apps/web`;
- autenticação, usuários, organizações, memberships e RLS;
- Privy e criação de wallets;
- BlindPay, KYC/KYB, payins, payouts e webhooks;
- Stellar, Soroban, OpenZeppelin e Relayer;
- eventos, tipos de ingresso, compras, tickets, check-in e financeiro;
- filas e processors BullMQ;
- relay do Outbox;
- CI/CD, deploy e observabilidade externa;
- qualquer secret ou credencial real.

As integrações externas não devem aparecer como dependências, variáveis de ambiente ou stubs nesta
SPEC.

## 5. Restrições e invariantes

1. Node.js 22 ou superior e pnpm 9, conforme o `package.json` da raiz.
2. TypeScript em modo strict, preservando as flags já definidas no `tsconfig.json` da raiz.
3. Nenhum pacote pode depender de código interno de outro app.
4. Apps podem depender de packages; packages não podem depender de apps.
5. `packages/shared` não pode abrir conexões nem ler `process.env`.
6. Apenas `packages/config` interpreta e valida variáveis de ambiente.
7. Apenas `packages/database` instancia e exporta o Prisma Client.
8. Apenas `packages/redis` instancia e exporta clientes Redis.
9. Redis será usado para filas, não como cache. A política de eviction deve ser `noeviction`.
10. Testes de integração usam serviços reais do `docker-compose.test.yml`; Prisma e Redis não são
   mockados nesses testes.
11. A API não deve retornar stack trace, URL de conexão ou detalhes internos de erro.
12. Nenhuma tabela de tenant será criada nesta SPEC; portanto, RLS fica explicitamente adiado.
13. Todo script da raiz deve funcionar em Windows, Linux e macOS, sem comandos específicos como
   `rm -rf`.

## 6. Estrutura de arquivos

```text
apps/
├── api/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── health/
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       ├── health.service.ts
│   │       └── health.types.ts
│   ├── test/
│   │   └── health.integration.spec.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── jest.config.ts
└── workers/
    ├── src/
    │   ├── main.ts
    │   └── workers.module.ts
    ├── package.json
    ├── tsconfig.json
    └── tsconfig.build.json

packages/
├── config/
│   ├── src/
│   │   ├── env.schema.ts
│   │   ├── env.service.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── database/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── redis/
│   ├── src/
│   │   ├── redis.module.ts
│   │   ├── redis.service.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── shared/
    ├── src/
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

`apps/web` e `packages/contracts` permanecem reservados, sem implementação nesta etapa.

## 7. Contratos dos packages

### 7.1 `@access/config`

Responsável por validar o ambiente uma única vez no startup e fornecer configuração tipada.

Interface pública mínima:

```typescript
export type AppEnvironment = "development" | "test" | "production";

export interface InfrastructureConfig {
  nodeEnv: AppEnvironment;
  databaseUrl: string;
  databaseDirectUrl: string;
  redisUrl: string;
}

export interface ApiConfig extends InfrastructureConfig {
  apiPort: number;
  healthCheckTimeoutMs: number;
}

export function loadInfrastructureConfig(
  environment?: NodeJS.ProcessEnv,
): InfrastructureConfig;

export function loadApiConfig(
  environment?: NodeJS.ProcessEnv,
): ApiConfig;
```

Regras:

- variáveis obrigatórias ausentes impedem o processo de iniciar;
- números inválidos, portas fora do intervalo e URLs inválidas são rejeitados;
- a mensagem de erro informa o nome da variável, mas nunca imprime seu valor;
- os apps recebem o objeto validado por injeção de dependência;
- não deve existir fallback silencioso para credenciais ou URLs de produção.

### 7.2 `@access/database`

Responsável pela instância única de Prisma em cada processo NestJS.

Interface pública mínima:

```typescript
export class PrismaService extends PrismaClient
  implements OnModuleDestroy {
  onModuleDestroy(): Promise<void>;
  ping(): Promise<void>;
}

export class PrismaModule {}
```

Regras:

- `PrismaModule` é global;
- `ping()` executa uma consulta constante equivalente a `SELECT 1`;
- a API usa conexão lazy para conseguir expor liveness mesmo durante indisponibilidade do banco;
- processos que exigem banco no startup, como workers, chamam `ping()` explicitamente;
- o módulo não conhece tenant, RLS ou modelos futuros;
- a configuração de conexão vem exclusivamente de `@access/config`;
- desconexão deve ocorrer no encerramento gracioso.

### 7.3 `@access/redis`

Responsável pelo ciclo de vida do cliente Redis usado pela API e pelos workers.

Interface pública mínima:

```typescript
export class RedisService implements OnModuleDestroy {
  ping(): Promise<void>;
  quit(): Promise<void>;
  onModuleDestroy(): Promise<void>;
}

export class RedisModule {}
```

Regras:

- `RedisModule` é global;
- a API pode iniciar sem conexão estabelecida e reporta a falha em readiness;
- workers chamam `ping()` no startup e falham imediatamente se Redis estiver indisponível;
- nenhuma opção de conexão pode habilitar cache ou esconder falhas indefinidamente;
- encerramento normal usa `QUIT`; desconexão forçada é reservada para falha de shutdown.

### 7.4 `@access/shared`

Começa deliberadamente pequeno. Pode exportar apenas tipos e constantes que já tenham dois ou mais
consumidores reais. Não deve virar um depósito de DTOs ou abstrações futuras.

## 8. Persistência inicial

### 8.1 Schema Prisma

A única entidade persistida nesta etapa é o registro técnico do Outbox, pois o padrão já foi
confirmado pelo ADR-002 e pela decisão D-14.

```prisma
enum OutboxEventStatus {
  PENDING    @map("pending")
  PROCESSING @map("processing")
  PROCESSED  @map("processed")
  FAILED     @map("failed")
}

model OutboxEvent {
  id               String            @id @default(uuid()) @db.Uuid
  deduplicationKey String            @unique @map("deduplication_key")
  aggregateType    String            @map("aggregate_type")
  aggregateId      String            @map("aggregate_id")
  eventType        String            @map("event_type")
  payload          Json
  status           OutboxEventStatus @default(PENDING)
  attempts         Int               @default(0)
  availableAt      DateTime          @default(now()) @map("available_at")
  processedAt      DateTime?         @map("processed_at")
  lastError        String?           @map("last_error")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  @@index([status, availableAt, createdAt])
  @@index([aggregateType, aggregateId])
  @@map("outbox_events")
}
```

O campo `deduplicationKey` deve ser fornecido pelo caso de uso futuro. Não usar a combinação
`aggregateId + eventType` como unicidade, pois o mesmo agregado pode emitir o mesmo tipo de evento
mais de uma vez durante sua vida.

### 8.2 Migration

A migration inicial deve:

- criar somente o enum e a tabela acima;
- criar os índices e a constraint de unicidade declarados;
- não criar tabelas de produto;
- não habilitar extensões PostgreSQL sem uma necessidade concreta;
- ser aplicável tanto no banco de desenvolvimento quanto no banco de testes.

### 8.3 RLS

RLS não será simulado nesta etapa. Ele será introduzido junto ao primeiro modelo de tenant, depois
de definida a relação entre identidade, organização e membership.

Quando introduzido, o contexto deverá compartilhar a mesma transação e conexão das queries de
negócio. Um `SET LOCAL` executado isoladamente por interceptor não é uma solução válida.

## 9. Redis

API e workers devem usar o `RedisModule` de `@access/redis`, configurado por `REDIS_URL`.

Regras:

- `maxmemory-policy` deve ser `noeviction` nos Compose de desenvolvimento e teste;
- a conexão deve falhar de maneira explícita no startup dos workers;
- a API pode iniciar para expor liveness, mas readiness deve falhar enquanto Redis estiver
  indisponível;
- os clientes devem ser fechados no `SIGTERM` e no `SIGINT`;
- nenhuma chave de cache será criada nesta SPEC.

## 10. API

### 10.1 Bootstrap

O bootstrap deve:

- carregar e validar o ambiente antes de abrir a porta HTTP;
- habilitar shutdown hooks;
- usar o prefixo global `/api`;
- configurar JSON com limite explícito de payload;
- não habilitar CORS permissivo por padrão;
- iniciar na porta configurada por `API_PORT`.

### 10.2 Liveness

`GET /api/health/live`

Não consulta dependências externas. Confirma somente que o processo HTTP está vivo.

Resposta `200`:

```json
{
  "status": "alive",
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### 10.3 Readiness

`GET /api/health/ready`

Executa, em paralelo e com timeout, `PrismaService.ping()` e `PING` no Redis.

Resposta `200` quando ambas as dependências respondem:

```json
{
  "status": "ready",
  "checks": {
    "database": "up",
    "redis": "up"
  },
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

Resposta `503` quando pelo menos uma dependência falha ou excede o timeout:

```json
{
  "status": "not_ready",
  "checks": {
    "database": "up",
    "redis": "down"
  },
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

A resposta não inclui mensagens de driver, hostnames, credenciais ou stack traces.

## 11. Processo de workers

`apps/workers` deve iniciar um contexto NestJS sem servidor HTTP.

Nesta SPEC ele apenas:

- valida o ambiente;
- conecta a PostgreSQL e Redis;
- registra que o processo ficou pronto usando o logger do NestJS;
- encerra as conexões de forma graciosa;
- retorna código diferente de zero se uma dependência obrigatória não puder ser inicializada.

Não criar filas vazias, processors fictícios ou nomes de jobs antecipadamente.

## 12. Variáveis de ambiente

Somente estas variáveis são consumidas nesta etapa:

```dotenv
NODE_ENV=development
API_PORT=3001
DATABASE_URL=postgresql://access:access@localhost:5432/access_dev
DATABASE_URL_DIRECT=postgresql://access:access@localhost:5432/access_dev
REDIS_URL=redis://localhost:6379
HEALTH_CHECK_TIMEOUT_MS=2000
```

As variáveis de Privy, BlindPay, Stellar, OpenZeppelin, email, rate limiting e contratos podem
continuar documentadas fora desta SPEC, mas nenhum processo deve exigi-las até a etapa que as
introduzir.

## 13. Docker Compose

### 13.1 Desenvolvimento

O `docker-compose.yml` deve oferecer:

- PostgreSQL 16;
- Redis 7 com `noeviction`;
- healthchecks para os dois serviços;
- volumes persistentes;
- ferramentas administrativas apenas por profiles opcionais;
- nenhum secret de produção.

Evitar `container_name` quando não houver necessidade, para permitir múltiplos worktrees e evitar
colisão entre projetos.

### 13.2 Testes

O `docker-compose.test.yml` deve oferecer:

- portas diferentes das usadas em desenvolvimento;
- PostgreSQL e Redis isolados;
- armazenamento efêmero;
- healthchecks;
- Redis com `noeviction`;
- nenhuma dependência de estado local anterior.

## 14. Scripts obrigatórios

Na raiz, os seguintes comandos devem delegar para o Turborepo e funcionar em todos os sistemas
operacionais suportados:

```text
pnpm build
pnpm dev
pnpm env:init
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:generate
pnpm db:migrate
pnpm clean
```

Cada workspace deve declarar somente os scripts que realmente implementa. O comando `clean` não
pode depender de `rm`, `rmdir` ou outro utilitário específico do shell.

## 15. Testes esperados

### 15.1 Unitários

- configuração de infraestrutura válida é convertida para `InfrastructureConfig`;
- configuração da API exige e converte `API_PORT` e `HEALTH_CHECK_TIMEOUT_MS`;
- variável obrigatória ausente interrompe o startup sem revelar valores;
- porta e timeout inválidos são rejeitados;
- liveness retorna o contrato definido;
- readiness agrega corretamente os estados de PostgreSQL e Redis;
- readiness retorna `503` quando uma dependência falha;
- readiness respeita `HEALTH_CHECK_TIMEOUT_MS`.

### 15.2 Integração

Usando `docker-compose.test.yml`:

- migrations aplicam em banco vazio;
- `PrismaService.ping()` responde;
- a constraint de `deduplicationKey` impede duplicidade no Outbox;
- Redis responde a `PING`;
- `GET /api/health/live` retorna `200` sem consultar dependências;
- `GET /api/health/ready` retorna `200` com PostgreSQL e Redis disponíveis;
- readiness retorna `503` quando Redis está indisponível;
- a aplicação fecha conexões sem deixar o processo de testes pendurado.

Não haverá teste end-to-end de fluxo de produto nesta etapa.

## 16. Ordem de implementação

1. Corrigir os manifests da raiz e criar o lockfile.
2. Implementar `packages/config` e seus testes.
3. Implementar `packages/database`, schema e migration.
4. Implementar `packages/redis`.
5. Ajustar os Docker Compose de desenvolvimento e teste.
6. Implementar bootstrap e health checks da API.
7. Implementar o bootstrap dos workers.
8. Configurar lint, typecheck e testes em todos os workspaces.
9. Executar a sequência completa de aceitação em ambiente limpo.

Não iniciar a SPEC-002 enquanto esta sequência não estiver verde.

## 17. Validação de aceitação

Em um checkout limpo, a seguinte sequência deve passar:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm env:init
docker compose up -d --wait postgres redis
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
```

Também deve ser demonstrado:

```bash
curl --fail http://localhost:3001/api/health/live
curl --fail http://localhost:3001/api/health/ready
```

## 18. Definição de pronto

- [x] `pnpm-lock.yaml` existe e está versionado.
- [x] Não restam `.gitkeep` nos workspaces implementados.
- [x] Nenhuma dependência de Privy, BlindPay, Stellar ou OpenZeppelin foi adicionada.
- [x] Nenhuma tabela de produto foi antecipada.
- [x] PostgreSQL e Redis sobem saudáveis em desenvolvimento e teste.
- [x] Redis usa `noeviction`.
- [x] Migration inicial aplica em banco vazio.
- [x] API e workers iniciam e encerram corretamente.
- [x] Liveness e readiness obedecem aos contratos desta SPEC.
- [x] `build`, `lint`, `typecheck`, testes unitários e testes de integração passam.
- [x] `.env.example` contém todas e somente as variáveis da fundação na seção ativa.
- [x] Nenhum secret foi adicionado ao repositório ou aos logs.
- [x] O diff foi revisado para confirmar que não implementa itens da SPEC-002.

### Evidência de validação — 29/09/2026

- instalação reproduzível confirmada com `pnpm install --frozen-lockfile`;
- `build`, `lint` e `typecheck` executados sem erros ou warnings;
- 11 testes unitários e 5 testes de integração aprovados;
- API validada em execução real nos endpoints `/api/health/live` e `/api/health/ready`;
- processo de workers validado contra PostgreSQL e Redis reais;
- migration inicial aplicada em banco vazio e política `noeviction` confirmada nos ambientes de
  desenvolvimento e teste.

## 19. Decisões adiadas explicitamente

As decisões abaixo pertencem às próximas etapas e não podem ser tomadas implicitamente durante a
implementação desta SPEC:

- modelo `User × Organization × Membership`;
- onboarding do comprador e resposta à Q-03;
- criação e propriedade de wallets Privy;
- estratégia transacional para contexto RLS;
- criação e patrocínio de contas Stellar;
- contratos e autoridade de assinatura;
- modelos de customer, pagamento e payout da BlindPay.
