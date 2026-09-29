# CLAUDE.md

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Ele define como trabalhar neste repositório. Leia-o por completo antes de qualquer tarefa.

---

## 1. O que é este projeto

GreetUp Access é uma plataforma de venda de ingressos, credenciamento e repasse financeiro para eventos corporativos B2B, construída sobre Stellar/Soroban, com integração a Privy (wallets) e BlindPay (Pix ↔ USDC).

Este é um sistema que vai processar dinheiro real de terceiros. Não é um protótipo, não é um MVP descartável. Cada linha de código aqui pode significar um comprador que não recebe o ingresso que pagou, ou um produtor que não recebe o dinheiro que vendeu.

## 2. Postura obrigatória

**Robustez e correção vêm antes de velocidade, sempre.** Se existe um caminho mais rápido e um caminho mais robusto, e o contexto não deixa claro qual usar, pare e pergunte — não assuma que "mais rápido" é o que se espera aqui.

**Você tem permissão explícita — e a obrigação — de parar quando encontrar:**
- Uma spec ambígua ou com informação faltando
- Uma decisão de arquitetura que a spec não cobre
- Um conflito entre duas specs
- Uma situação onde a implementação "óbvia" pode comprometer segurança, idempotência ou consistência financeira

Preferir perguntar a assumir. Um assumir errado em fluxo financeiro é caro. Uma pergunta custa 30 segundos.

**Nunca marque uma etapa como concluída se ela não passar integralmente na Definição de Pronto da spec correspondente.** Concluído parcialmente é bloqueado, não concluído.

---

## 3. Leitura obrigatória antes de codar

Antes de implementar qualquer SPEC, leia nesta ordem:

1. `docs/06-sdd/OVERVIEW.md` — mapa de dependências e ordem de implementação
2. A SPEC específica que você vai implementar, em `docs/06-sdd/SPEC-XXX-*.md`
3. `docs/02-project/data-model.md` — se a spec envolve entidades do banco
4. `docs/02-project/integrations.md` — se a spec envolve BlindPay, Privy ou Soroban
5. Os ADRs referenciados na spec, em `docs/03-adrs/` — para entender o porquê das decisões, não só o quê

Nunca implemente uma spec sem antes confirmar que suas dependências (listadas no `OVERVIEW.md`) já estão implementadas e passando nos testes.

---

## 4. Loop operacional — repita para cada SPEC

```
1. LER a spec completa antes de escrever qualquer código
2. CONFIRMAR que as dependências da spec estão prontas (rodar os testes delas)
3. PLANEJAR em voz alta: quais arquivos vão ser criados/alterados, nessa ordem
4. IMPLEMENTAR seguindo exatamente a estrutura de arquivos e assinaturas da spec
5. TESTAR — escrever e rodar os testes unitários E de integração listados na spec
6. VERIFICAR a Definição de Pronto item por item, explicitamente
7. REPORTAR o resultado seguindo o protocolo da seção 8
```

Não pule etapas. Não implemente "adiantado" uma spec futura porque parece conveniente — a ordem de dependências existe por razão de arquitetura, não é sugestão.

Se uma spec for grande (SPEC-006, SPEC-009, SPEC-013), é aceitável dividir em sub-entregas dentro da mesma spec, mas comunique isso explicitamente antes de começar: "Vou dividir a SPEC-006 em: (1) TicketContract, (2) EscrowContract, (3) testes de integração cruzada" — e trate cada uma como um checkpoint reportável.

---

## 5. Condições de parada — pare e pergunte se

- A spec referencia um arquivo, tipo ou função que não existe e não está em nenhuma spec anterior
- Duas specs descrevem a mesma entidade ou endpoint de forma incompatível
- Uma variável de ambiente necessária não está em `.env.example`
- Você precisaria inventar uma regra de negócio que não está documentada em `docs/01-vision/product-vision.md` ou nas specs
- A implementação exigiria armazenar dado pessoal on-chain (violação de RN-010 — nunca fazer, mas se a spec parecer pedir isso, é sinal de erro na spec, não permissão para violar a regra)
- Você identificar que uma decisão de uma spec conflita com um ADR existente
- Os testes esperados na spec não são suficientes para cobrir um caso de borda óbvio que você identificou
- Uma migration de banco entraria em conflito com dados já existentes em ambiente não-local

Nesses casos: **pare, explique o gap encontrado, proponha 1-2 alternativas com trade-offs, e espere confirmação antes de prosseguir.** Não escolha silenciosamente a alternativa que parece mais razoável.

---

## 6. Regras técnicas inegociáveis

Estas regras valem independentemente do que uma spec disser. Se uma spec parecer contradizer alguma destas, é a spec que está errada — pare e reporte.

1. **RLS sempre ativo.** Toda query em tabela com `organization_id` passa pelo `TenantInterceptor`. Nunca adicionar `WHERE organization_id = ?` manual como substituto do RLS — são camadas complementares, não alternativas.
2. **Toda escrita que gera evento de domínio usa `prisma.$transaction` + `OutboxService.publish()` dentro da mesma transação.** Nunca publicar evento fora da transação que gerou o estado.
3. **Todo consumer de fila (worker) é idempotente.** Verificar estado atual antes de processar. Um job pode ser executado mais de uma vez — o resultado final deve ser o mesmo.
4. **Nunca armazenar dado pessoal on-chain.** Nome, email, CPF, telefone, dados bancários — sempre off-chain (PostgreSQL). On-chain só IDs, endereços de wallet, estados e hashes.
5. **Nunca expor chave privada em código, log, variável de ambiente commitada ou resposta de API.** Signing de Treasury sempre via `KmsService`, nunca `Keypair.fromSecret()` com secret em texto.
6. **Todo endpoint que recebe webhook valida assinatura HMAC antes de processar qualquer coisa.** Sem exceção, mesmo em ambiente de desenvolvimento.
7. **Operações financeiras críticas (release, block, refund do escrow) sempre passam por multi-sig conforme definido no contrato.** Nunca criar um "atalho" de admin único, nem em teste, que possa vazar para produção.
8. **Nenhum `console.log` de debug commitado.** Use o logger estruturado (Pino) com nível apropriado.
9. **Nenhuma variável de ambiente sem entrada correspondente em `.env.example`.**

---

## 7. Barra de qualidade de testes

Uma spec não está pronta só porque compila. Antes de reportar conclusão:

- [ ] Testes unitários cobrem os cenários explicitamente listados na spec — não apenas o caminho feliz
- [ ] Testes de integração usam banco e Redis reais (`docker-compose.test.yml`), nunca mock de Prisma
- [ ] Pelo menos um teste cobre o cenário de idempotência quando a spec envolve fila ou webhook
- [ ] Pelo menos um teste cobre falha/erro esperado (não apenas sucesso)
- [ ] `pnpm turbo typecheck` sem erros
- [ ] `pnpm turbo lint` sem warnings novos
- [ ] Nenhum teste foi pulado (`.skip`) ou comentado para "passar depois"

Se um teste esperado na spec não fizer sentido após a implementação (por exemplo, um cenário que se mostrou impossível), reporte isso explicitamente — não delete o teste silenciosamente.

---

## 8. Protocolo de comunicação

Ao concluir uma spec (ou um checkpoint dentro dela), reporte neste formato:

```
## SPEC-XXX — [nome] — [CONCLUÍDA | BLOQUEADA | PARCIAL]

### O que foi implementado
- [lista objetiva dos arquivos criados/alterados]

### Testes
- Unitários: X/Y passando
- Integração: X/Y passando

### Definição de Pronto
- [x] item 1
- [x] item 2
- [ ] item 3 — [motivo de não estar concluído, se aplicável]

### Gaps ou decisões que precisam de confirmação
- [se houver — descreva o gap, proponha alternativas, não decida sozinho]

### Próximo passo sugerido
- SPEC-YYY, pois depende do que foi concluído aqui
```

Se algo bloquear no meio da implementação, reporte imediatamente — não continue tentando contornar em silêncio por múltiplas tentativas. Duas tentativas falhas no mesmo problema é o limite antes de parar e explicar o que foi tentado.

---

## 9. Convenções de código — referência rápida

| Contexto | Convenção | Exemplo |
|---|---|---|
| Estados de entidade | `snake_case` (nos enums Prisma, `SCREAMING_SNAKE_CASE`) | `pending_settlement` / `PENDING_SETTLEMENT` |
| Eventos de domínio | `dominio.acao` | `payment.confirmed` |
| Jobs BullMQ | `PascalCase + Job` | `MintTicketJob` |
| Variáveis de ambiente | `SCREAMING_SNAKE_CASE` | `BLINDPAY_API_KEY` |
| Módulos NestJS | `PascalCase + Module` | `TicketsModule` |
| Serviços NestJS | `PascalCase + Service` | `StellarService` |
| Contratos Soroban | `snake_case` para funções, `PascalCase` para structs | `check_in()`, `TicketData` |
| Branches | `feat/`, `fix/`, `docs/`, `contracts/` | `feat/mint-worker` |
| Commits | Conventional Commits | `feat: adiciona MintTicketJob` |

TypeScript sempre em modo strict. Nunca usar `any` — se o tipo é genuinamente desconhecido, usar `unknown` e fazer narrowing explícito.

---

## 10. Comandos essenciais

```bash
# Setup inicial
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed

# Desenvolvimento
pnpm dev                          # todos os apps
pnpm turbo dev --filter=api       # apenas a API

# Testes
pnpm turbo test                   # unitários, todos os apps
pnpm turbo test --filter=api      # unitários de um app específico
docker compose -f docker-compose.test.yml up -d
pnpm turbo test:integration
docker compose -f docker-compose.test.yml down

# Qualidade
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo format -- --check

# Contratos Soroban
cd packages/contracts
cargo test
stellar contract build --release

# Banco de dados
pnpm db:generate                  # gera Prisma Client após mudança de schema
pnpm db:migrate                   # aplica migrations
```

---

## 11. Definição de Pronto (global)

Além da Definição de Pronto específica de cada SPEC, toda entrega neste repositório respeita:

- [ ] Segue exatamente a estrutura de arquivos definida na spec
- [ ] Assinaturas de função batem com o que a spec especificou (tipos incluídos)
- [ ] Nenhum secret ou credencial em texto no código
- [ ] `docs/06-sdd/OVERVIEW.md` seria atualizado se a ordem de dependências mudasse (avisar se identificar necessidade)
- [ ] Testes cobrem idempotência, falha e o caminho feliz
- [ ] Reportado no formato da seção 8

---

## 12. Onde estão as coisas

```
docs/
├── 01-vision/product-vision.md        ← problema, escopo, regras de negócio
├── 02-project/                         ← arquitetura C4, modelo de dados, integrações
├── 03-adrs/                            ← por que cada decisão técnica foi tomada
├── 04-runbooks/                        ← procedimentos operacionais (incidentes, deploy)
├── 05-glossary/glossary.md             ← todo termo técnico do projeto definido
└── 06-sdd/                             ← especificações de implementação, comece aqui
    ├── OVERVIEW.md
    └── SPEC-001 a SPEC-013

apps/
├── api/         NestJS — API REST + WebSocket
├── web/         Next.js 15 — frontend + PWA de credenciamento
└── workers/     BullMQ workers isolados

packages/
├── contracts/   Rust + Soroban — TicketContract + EscrowContract
├── database/    Prisma schema + migrations
├── shared/      Tipos TypeScript compartilhados
└── config/      ESLint, TSConfig base
```

Quando em dúvida sobre onde algo deveria viver, verifique a estrutura de arquivos exata definida na SPEC correspondente antes de decidir por conta própria.
