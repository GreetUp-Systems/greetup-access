# Access — Documentação Técnica

> Solução para vender ingressos, controlar a entrada e receber pelas vendas, para eventos de qualquer tipo e tamanho.
> Stack: Stellar · Soroban · Privy · BlindPay · NestJS · Next.js · PostgreSQL · BullMQ

> ⚠️ **Arquitetura vigente:** [`06-sdd/MVP-REVISADO.md`](./06-sdd/MVP-REVISADO.md) (revisão original de 20/08/2026; identidade atualizada em 29/09/2026).
> É a fonte de verdade da arquitetura. Em qualquer conflito com outro documento, vale ele.

---

## Índice

### [01 · Visão do Produto](./01-vision/product-vision.md)
Problema, escopo, funcionalidades, regras de negócio, fluxos principais, stack e custos.

### 02 · Documento de Projeto

> ⚠️ **Anterior à revisão de arquitetura de 20/08/2026 e parcialmente desatualizado.** Em qualquer
> conflito, vale o [`MVP-REVISADO.md`](./06-sdd/MVP-REVISADO.md).

| Arquivo | Conteúdo |
|---|---|
| [Atores e Personas](./02-project/actors-and-personas.md) | Perfis, responsabilidades e interações com o sistema |
| [Casos de Uso](./02-project/use-cases.md) | Todos os fluxos com pré-condições e resultados esperados |
| [Histórias de Usuário](./02-project/user-stories.md) | Por perfil, com critério de aceite |
| [Arquitetura C4](./02-project/architecture-c4.md) | Contexto (N1), Containers (N2), Componentes (N3) |
| [Diagramas de Sequência](./02-project/sequence-diagrams.md) | Um fluxo por seção — compra, credenciamento, payout |
| [Modelo de Dados](./02-project/data-model.md) | Entidades, enums de estado, relacionamentos, dados on/off-chain |
| [Contratos de Integração](./02-project/integrations.md) | BlindPay, Privy, Soroban — endpoints, payloads, webhooks |
| [Ferramentas de Desenvolvimento](./02-project/development-tooling.md) | Setup das skills e conexões MCP sem credenciais |

### 03 · Architecture Decision Records (ADRs)

| ADR | Decisão |
|---|---|
| [ADR-001](./03-adrs/ADR-001-stellar-over-evm.md) | Stellar sobre EVM como blockchain principal |
| [ADR-002](./03-adrs/ADR-002-outbox-pattern.md) | Outbox Pattern para garantia de entrega de eventos |
| [ADR-004](./03-adrs/ADR-004-blindpay-ramp.md) | BlindPay como provedor exclusivo de on/off-ramp no MVP |
| [ADR-005](./03-adrs/ADR-005-rls-multitenancy.md) | Row-Level Security para isolamento de tenants |
| [ADR-006](./03-adrs/ADR-006-bullmq-over-kafka.md) | BullMQ sobre Kafka para mensageria |
| [ADR-007](./03-adrs/ADR-007-railway-deploy.md) | Railway como plataforma de deploy no MVP |
| [ADR-009](./03-adrs/ADR-009-identity-producer-tenancy.md) | `User`, produtor 1:1, wallet e onboarding OTP no MVP |

### 04 · Runbooks Operacionais

| Runbook | Situação |
|---|---|
| [RB-001](./04-runbooks/RB-001-production-deploy.md) | Deploy em produção |
| [RB-003](./04-runbooks/RB-003-dead-letter-queue.md) | Jobs na Dead-Letter Queue |
| [RB-004](./04-runbooks/RB-004-live-event-incident.md) | Incidente durante evento ao vivo |
| [RB-005](./04-runbooks/RB-005-blindpay-failure.md) | Falha do BlindPay |

### [05 · Glossário Técnico](./05-glossary/glossary.md)
Todos os termos do projeto com definição precisa no contexto do Access.

### 06 · Spec-Driven Development

| Arquivo | Conteúdo |
|---|---|
| [MVP Revisado](./06-sdd/MVP-REVISADO.md) | **Fonte de verdade da arquitetura** — decisões D-01 a D-19 e questões em aberto |
| [Overview](./06-sdd/OVERVIEW.md) | Blocos de implementação, dependências e status de cada SPEC |

### Arquivo

Documentação superada pela revisão de arquitetura, mantida só como registro histórico:
[`_archive/README.md`](./_archive/README.md).

---

## Convenções

- **Estados de entidade** são sempre em `snake_case` e definidos no modelo de dados
- **Nomes de eventos** seguem o padrão `dominio.acao` (ex: `ticket.issued`, `payment.confirmed`)
- **Nomes de jobs** seguem o padrão `NomeJob` em PascalCase (ex: `MintTicketJob`)
- **Variáveis de ambiente** em `SCREAMING_SNAKE_CASE` documentadas em cada serviço
- Diagramas em texto (Mermaid/ASCII) — renderizáveis no GitHub e no VS Code com extensão Mermaid

## Status

| Documento | Versão | Status |
|---|---|---|
| Visão do Produto | 0.5 | Em revisão |
| MVP Revisado | — | Arquitetura vigente — 22 decisões |
| Documento de Projeto | 0.1 | Desatualizado — anterior à revisão |
| ADRs | 0.1 | Em revisão |
| Runbooks | 0.1 | Em revisão |
| Glossário | 0.1 | Em revisão |

> **Última atualização:** 29/09/2026 · **Responsável:** Matheus Aguiar
