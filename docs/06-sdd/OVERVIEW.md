# SDD — Spec-Driven Development · Access

> ⚠️ **Leia [`MVP-REVISADO.md`](./MVP-REVISADO.md) antes de qualquer coisa.**
>
> A arquitetura foi revisada em 20/08/2026, com identidade atualizada em 29/09/2026, e boa parte
> das SPEC-003 a SPEC-013 continua vencida.
> O `MVP-REVISADO.md` é a **fonte de verdade** da arquitetura: vinte e duas decisões, com o porquê
> de cada uma, e a tabela do que foi superado.
>
> **Não implemente a partir de uma SPEC sem antes conferir aquela tabela.** Várias descrevem
> componentes que deixaram de existir — `EscrowContract`, Treasury própria com KMS, multi-sig
> 2-of-3, CQRS com projeção em Redis, gateway WebSocket.

---

## Contexto do Projeto

**Repositório:** `github.com/GreetUp-Corp/access-platform`

**Stack:** Stellar · Privy · BlindPay · OpenZeppelin (contratos + Relayer) · NestJS · Next.js 15 ·
PostgreSQL 16 · BullMQ · Redis · Turborepo

**Padrões:** Event-Driven · Outbox Pattern · RLS por produtor

**Documentação de referência:**
- Arquitetura vigente: [`MVP-REVISADO.md`](./MVP-REVISADO.md)
- Visão do Produto: `docs/01-vision/product-vision.md`
- Modelo de Dados: `docs/02-project/data-model.md` *(desatualizado)*
- Integrações: `docs/02-project/integrations.md` *(desatualizado)*
- ADRs: `docs/03-adrs/`

---

## Execução incremental

O desenvolvimento avança com **uma SPEC ativa por vez**:

1. a SPEC é revisada contra o `MVP-REVISADO.md` e as fontes atuais das integrações afetadas;
2. escopo, não escopo, invariantes, contratos e critérios de aceite são fechados;
3. somente então a implementação começa;
4. a próxima SPEC permanece bloqueada até build, lint, typecheck e testes da etapa ativa passarem;
5. decisões futuras não são antecipadas no schema, nas abstrações nem nas variáveis de ambiente.

**SPEC ativa:** [`SPEC-002 — Identidade, autenticação e wallet`](./SPEC-002-auth.md), aprovada para
implementação em 29/09/2026.

O [`ADR-009`](../03-adrs/ADR-009-identity-producer-tenancy.md) fechou identidade, wallet, modelo de
produtor e a Q-03 em 29/09/2026.

---

## Regras globais

1. **TypeScript strict mode** em todos os arquivos. Sem `any` implícito.
2. **Nunca commitar secrets.** Toda variável sensível via `process.env` com validação no startup.
3. **Todo módulo NestJS** tem: `module.ts`, `controller.ts` (se aplicável), `service.ts`, `dto/`,
   `entities/`, `__tests__/`.
4. **Todo job BullMQ é idempotente.** Sempre verificar estado antes de processar.
5. **Toda escrita no banco** que gera evento de domínio usa `prisma.$transaction` + `OutboxService`.
6. **Nomenclatura:** estados em `snake_case`, eventos em `dominio.acao`, jobs em `PascalCase + Job`.
7. **Testes de integração** usam banco e Redis reais (`docker-compose.test.yml`). Nunca mockar Prisma.
8. **RLS obrigatório em tabelas de produtor.** O contexto deve usar a mesma transação e conexão das
   queries protegidas; `SET LOCAL` isolado em um interceptor não é suficiente.

---

## Arquitetura em uma frase

**Privy cria as carteiras, BlindPay move o dinheiro, e a Stellar guarda o ingresso.**

O ingresso não espera o dinheiro chegar — basta a confirmação do Pix para emitir. São dois
sistemas desacoplados, ligados pelo nosso banco de dados.

Infraestrutura: Postgres, Redis apenas para o BullMQ, três workers (`OutboxRelay`,
`MintTicketWorker`, `NotifyWorker`) e um endpoint SSE.

---

## Ordem de Implementação

Derivada das decisões do `MVP-REVISADO.md`. Cada bloco é entregável e testável.

| # | Bloco | Conteúdo | Depende de |
|---|---|---|---|
| 1 | Fundação | Monorepo, runtime da API/workers, Prisma, Outbox mínimo, Docker, configuração, liveness/readiness e testes | — |
| 2 | Identidade, auth e wallet | Privy, access token, `User`, wallet Stellar 1:1 e bootstrap idempotente | 1 |
| 3 | Produtor | `ProducerProfile` 1:1, RLS transacional, customer BlindPay + KYC, conta Stellar e trustline patrocinadas pelo Relayer | 2 |
| 4 | Eventos | CRUD de eventos e tipos de ingresso, página pública | 3 |
| 5 | Contrato do ingresso | Extensão do NFT auditado da OpenZeppelin: mint idempotente, check-in, vínculo com evento | 1 |
| 6 | Compra | Checkout com wallet, payin quote, webhook, Outbox, `MintTicketWorker` | 4 + 5 |
| 7 | Área do comprador | Meus ingressos, QR Code assinado, SSE na tela de espera | 6 |
| 8 | Check-in online | Validação e registro on-chain | 6 |
| 9 | Financeiro | Ledger, saldo, saque via payout BlindPay | 6 |
| 10 | CI/CD e deploy | Pipeline reduzido, sem observabilidade | qualquer |

**Fase 2, após validação:** capacidade offline do credenciamento (service worker, IndexedDB,
snapshot assinado, sincronização, conflito) e recebimento em USDC na Stellar via CCTP.

---

## Definição global de "Pronto"

- [ ] Todos os arquivos definidos existem
- [ ] `pnpm typecheck` passa sem erros
- [ ] `pnpm lint` passa sem warnings
- [ ] `pnpm build` passa sem erros
- [ ] Testes unitários e de integração passam
- [ ] Nenhuma variável de ambiente não documentada em `.env.example`
- [ ] Nenhum `console.log` de debug no código commitado
- [ ] A implementação não antecipa itens de SPECs posteriores

---

## Status das SPECs

| SPEC | Situação |
|---|---|
| SPEC-001 foundation | **Implementada e validada em 29/09/2026** — Foundation v2 concluída |
| SPEC-002 auth | **Ativa e aprovada para implementação** — reescrita e aprovada em 29/09/2026 conforme ADR-009 |
| SPEC-003 producer | Reescrever sem `Organization`/`Membership`; BlindPay usa *customer*, não *receiver* — [versão anterior arquivada](../_archive/06-sdd/SPEC-003-organizations.md) |
| SPEC-004 events | Válida, com resíduo de escrow no cancelamento |
| SPEC-005 purchase | Reescrever: fluxo de payin quote → payin — [arquivada](../_archive/06-sdd/SPEC-005-purchase.md) |
| SPEC-006 contracts | **Reescrever:** `EscrowContract` sai; `TicketContract` vira extensão da OZ. Contém bug de tipo (`Symbol` não comporta UUID) — [arquivada](../_archive/06-sdd/SPEC-006-contracts.md) |
| SPEC-007 mint worker | Reescrever: sai Treasury própria e criação de wallet do caminho crítico — [arquivada](../_archive/06-sdd/SPEC-007-mint-worker.md) |
| SPEC-008 ticket read | Reescrever sem CQRS — [arquivada](../_archive/06-sdd/SPEC-008-ticket-read.md) |
| SPEC-009 checkin | Dividir: online na fase 1, offline na fase 2 |
| SPEC-010 finance | Reescrever: não há escrow — [arquivada](../_archive/06-sdd/SPEC-010-finance.md) |
| SPEC-011 withdrawal | Reescrever: saque é payout da BlindPay — [arquivada](../_archive/06-sdd/SPEC-011-withdrawal.md) |
| SPEC-012 dashboard | Reduzir: polling em vez de WebSocket |
| SPEC-013 pipeline | Reduzir: sem OpenTelemetry, Grafana ou deploy multi-sig |

As SPECs serão reescritas **no momento de implementar cada bloco**, não antes. Identidade e Q-03
foram fechadas pelo ADR-009. Antes de reescrever os blocos 3, 5, 6 e 8, devem ser resolvidas as
demais questões aplicáveis do §9 do `MVP-REVISADO.md`.
