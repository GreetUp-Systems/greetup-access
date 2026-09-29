# Contribuindo para o GreetUp Access

## Convenções de Código

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona fluxo de reembolso parcial
fix: corrige timeout no MintWorker
docs: atualiza ADR-001 com decisão final
chore: atualiza dependências
test: adiciona testes de integração para OutboxService
refactor: extrai StellarService para package separado
```

### Branches

```
feat/nome-da-feature
fix/descricao-do-bug
docs/o-que-esta-documentando
contracts/nome-do-contrato-versao
```

### Pull Requests

- Descrição clara do que muda e por quê
- Linkar o issue ou ADR relacionado
- Todos os testes passando
- Coverage não pode diminuir nos módulos críticos
- Pelo menos 1 aprovador antes de mergear em `develop`
- 2 aprovadores para `staging` e `main`

## Convenções do Projeto

### Nomenclatura

| Contexto | Convenção | Exemplo |
|---|---|---|
| Estados de entidade | `snake_case` | `pending_settlement` |
| Eventos de domínio | `dominio.acao` | `payment.confirmed` |
| Jobs BullMQ | `PascalCase + Job` | `MintTicketJob` |
| Variáveis de ambiente | `SCREAMING_SNAKE_CASE` | `BLINDPAY_API_KEY` |
| Módulos NestJS | `PascalCase + Module` | `TicketsModule` |
| Serviços NestJS | `PascalCase + Service` | `StellarService` |
| Contratos Soroban | `snake_case` | `ticket_contract` |

### O que não fazer

- Nunca fazer commit com `.env` com valores reais
- Nunca armazenar dados pessoais on-chain
- Nunca fazer `git push --force` em `main` ou `staging`
- Nunca deployar em produção sem passar pelo staging primeiro
- Nunca adicionar dependência sem revisar o seu impacto no bundle e segurança

## Ambiente de Desenvolvimento

```bash
# Setup inicial
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`git config core.hooksPath .githooks` — ativa os hooks do repositório

## Testes

Antes de abrir um PR, garanta que:

```bash
pnpm typecheck  # sem erros de tipo
pnpm lint       # sem erros de lint
pnpm test       # unitários passando
pnpm test:integration  # integração passando
```
