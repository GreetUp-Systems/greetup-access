# SDD — Spec-Driven Development · Access

> ⚠️ **Leia [`MVP-REVISADO.md`](./MVP-REVISADO.md) antes de qualquer coisa.**
>
> A arquitetura foi revisada em 20/08/2026, com identidade atualizada em 29/09/2026, e boa parte
> das SPEC-003 a SPEC-013 continua vencida.
> O `MVP-REVISADO.md` é a **fonte de verdade** da arquitetura: vinte e cinco decisões, com o porquê
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

**Rede blockchain ativa para desenvolvimento e validação:** Stellar Testnet com USDB (BlindPay) e
USDC de teste. Pubnet/USDC
só será habilitada numa etapa explícita de preparação para produção.

**Documentação de referência:**

- Arquitetura vigente: [`MVP-REVISADO.md`](./MVP-REVISADO.md)
- Visão do Produto: `docs/01-vision/product-vision.md`
- Modelo de Dados: `docs/02-project/data-model.md` _(desatualizado)_
- Integrações: `docs/02-project/integrations.md` _(desatualizado)_
- ADRs: `docs/03-adrs/`

---

## Execução incremental

O desenvolvimento avança com **uma SPEC ativa por vez**:

1. a SPEC é revisada contra o `MVP-REVISADO.md` e as fontes atuais das integrações afetadas;
2. escopo, não escopo, invariantes, contratos e critérios de aceite são fechados;
3. somente então a implementação começa;
4. a próxima SPEC permanece bloqueada até build, lint, typecheck e testes da etapa ativa passarem;
5. decisões futuras não são antecipadas no schema, nas abstrações nem nas variáveis de ambiente.

**SPEC ativa:** [`SPEC-016 — App web · Site público`](./SPEC-016-web-public-site.md), parte 16A
(moldura do site), a próxima da sequência do app web: SPEC-015 15A e 15B prontas → 16A → SPEC-014 9D
→ 15C → 15D → validação real → 16B a 16D. Os smokes que dependem da assinatura do usuário (3C da
SPEC-003 e ponta a ponta da SPEC-005) são validados pelo app web. Production usa o mesmo modelo de
signer (D-24) e fica liberada só na etapa explícita de habilitação de Pubnet/USDC.

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

| #   | Bloco                     | Conteúdo                                                                                                                                           | Depende de |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Fundação                  | Monorepo, runtime da API/workers, Prisma, Outbox mínimo, Docker, configuração, liveness/readiness e testes                                         | —          |
| 2   | Identidade, auth e wallet | Privy, access token, `User`, wallet Stellar 1:1 e bootstrap idempotente                                                                            | 1          |
| 3   | Produtor                  | `ProducerProfile` 1:1, RLS transacional, customer BlindPay + KYC; conta e trustline têm reservas patrocinadas pelo Access e taxa paga pelo Relayer | 2          |
| 4   | Eventos                   | CRUD de eventos e tipos de ingresso, página pública                                                                                                | 3          |
| 5   | Contrato do ingresso      | Extensão do NFT auditado da OpenZeppelin: mint idempotente, check-in, vínculo com evento                                                           | 1          |
| 6   | Compra                    | Checkout com wallet, payin quote, webhook, Outbox, `MintTicketWorker`                                                                              | 4 + 5      |
| 7   | Área do comprador         | Meus ingressos, QR Code assinado, SSE na tela de espera                                                                                            | 6          |
| 8   | Check-in online           | Validação e registro on-chain                                                                                                                      | 6          |
| 9   | Financeiro                | Ledger, saldo, saque via payout BlindPay                                                                                                           | 6          |
| 10  | CI/CD e deploy            | Pipeline reduzido, sem observabilidade                                                                                                             | qualquer   |
| 11  | Site público              | Moldura pública, vitrine, busca com filtros e Para produtores (D-29); capa no R2, cidade do IBGE e categoria (D-30)                                | 4 + 7      |

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

| SPEC                     | Situação                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPEC-001 foundation      | **Implementada e validada em 29/09/2026** — Foundation v2 concluída                                                                                                                                                                                                 |
| SPEC-002 auth            | **Implementada e validada em 30/09/2026** — identidade e wallet user-owned concluídas conforme ADR-009                                                                                                                                                              |
| SPEC-003 producer        | **3A/3B e implementação automatizada de 3C (v1.4) validados localmente; smokes reais pendentes** — [nova versão](./SPEC-003-producer.md); 3C restrito a development/testnet pelo ADR-010. [Versão anterior arquivada](../_archive/06-sdd/SPEC-003-organizations.md) |
| SPEC-004 events          | **Implementação automatizada validada localmente em 02/10/2026** — [nova versão](./SPEC-004-events.md). [Versão anterior arquivada](../_archive/06-sdd/SPEC-004-events.md)                                                                                          |
| SPEC-005 purchase        | **6A a 6D implementadas em 04/10/2026; smoke ponta a ponta pendente** — [nova versão](./SPEC-005-purchase.md). [Versão anterior arquivada](../_archive/06-sdd/SPEC-005-purchase.md)                                                                                 |
| SPEC-006 contracts       | **Implementada e implantada na Testnet em 03/10/2026** — [nova versão](./SPEC-006-ticket-contract.md). [Versão anterior arquivada](../_archive/06-sdd/SPEC-006-contracts.md)                                                                                        |
| SPEC-007 mint worker     | **Absorvida pela SPEC-005 (parte 6C)** — [arquivada](../_archive/06-sdd/SPEC-007-mint-worker.md)                                                                                                                                                                    |
| SPEC-008 buyer area      | **7A e 7B implementadas em 04/10/2026; e-mail real pendente do smoke pelo front** — [nova versão](./SPEC-008-buyer-area.md). [Versão anterior arquivada](../_archive/06-sdd/SPEC-008-ticket-read.md)                                                                |
| SPEC-009 checkin         | Dividir: online na fase 1, offline na fase 2                                                                                                                                                                                                                        |
| SPEC-010 finance         | Reescrever: não há escrow — [arquivada](../_archive/06-sdd/SPEC-010-finance.md)                                                                                                                                                                                     |
| SPEC-011 withdrawal      | Reescrever: saque é payout da BlindPay — [arquivada](../_archive/06-sdd/SPEC-011-withdrawal.md)                                                                                                                                                                     |
| SPEC-012 dashboard       | Reduzir: polling em vez de WebSocket                                                                                                                                                                                                                                |
| SPEC-013 pipeline        | Reduzir: sem OpenTelemetry, Grafana ou deploy multi-sig                                                                                                                                                                                                             |
| SPEC-014 web purchase    | **Em implementação:** 9A, 9B e 9C prontas; 9D depois da moldura do site (SPEC-016 16A) — [nova versão](./SPEC-014-web-purchase.md)                                                                                                                                  |
| SPEC-015 web producer    | **Em implementação (v1.4):** sistema do produtor; 15A (backend) pronta em 08/10/2026 e 15B (esqueleto e Painel) em 09/10/2026; a seguir 16A → 9D → 15C → 15D → validação real — [SPEC](./SPEC-015-web-producer.md)                                                  |
| SPEC-016 web public site | **Aprovada (v1.0):** site público; 16A antes do 9D, 16B a 16D depois da validação da SPEC-015 — [SPEC](./SPEC-016-web-public-site.md)                                                                                                                               |

As SPECs serão reescritas **no momento de implementar cada bloco**, não antes. Identidade e Q-03
foram fechadas pelo ADR-009; Q-01 e Q-02 foram fechadas em 02/10/2026 pelas D-24 e D-23. Não há
questões de arquitetura em aberto no §9 do `MVP-REVISADO.md`.
