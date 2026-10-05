# CLAUDE.md

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Ele define como trabalhar neste repositório. Leia-o por completo antes de qualquer tarefa.

---

## 1. O que é este projeto

Access é uma solução para vender ingressos, controlar a entrada e receber pelas vendas, para eventos de qualquer tipo e tamanho. É construída sobre Stellar/Soroban, com integração a Privy (wallets), BlindPay (Pix ↔ USDC) e OpenZeppelin (contrato NFT auditado e Relayer para gas).

**Arquitetura em uma frase:** Privy cria as carteiras, BlindPay move o dinheiro, e a Stellar guarda o ingresso. A fonte de verdade da arquitetura é docs/06-sdd/MVP-REVISADO.md.

Toda a camada web3 fica abstraída. Para quem usa, o Access funciona como qualquer app comum.

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

1. `docs/06-sdd/MVP-REVISADO.md` — **fonte de verdade da arquitetura**: decisões D-01 a D-25, dívidas conscientes, notas de implementação e questões em aberto (§9)
2. `docs/06-sdd/OVERVIEW.md` — blocos de implementação, dependências e status de cada SPEC
3. A SPEC específica que você vai implementar, em `docs/06-sdd/SPEC-XXX-*.md`
4. Os ADRs referenciados na spec, em `docs/03-adrs/` — para entender o porquê das decisões, não só o quê

`docs/02-project/` (modelo de dados, integrações, C4, casos de uso) é **anterior à revisão** e está
parcialmente desatualizado. Use como referência, nunca como autoridade: em conflito, vale o
`MVP-REVISADO.md`. O conteúdo de `docs/_archive/` está superado — não implemente a partir dele.

Nunca implemente uma spec sem antes confirmar que suas dependências (listadas no `OVERVIEW.md`) já estão implementadas e passando nos testes.

Várias SPECs ainda serão reescritas. Se o bloco que você vai implementar não tem SPEC válida, pare: a SPEC é escrita antes do código, não durante.

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

Se uma spec for grande, é aceitável dividir em sub-entregas dentro da mesma spec, mas comunique isso explicitamente antes de começar: "Vou dividir a SPEC de compra em: (1) payin quote e payin, (2) webhook e Outbox, (3) MintTicketWorker" — e trate cada uma como um checkpoint reportável.

---

## 5. Condições de parada — pare e pergunte se

- A spec contradiz uma decisão do MVP-REVISADO.md
- A implementação depende de uma questão em aberto listada no §9 do MVP-REVISADO.md
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
5. **Nunca expor chave privada em código, log, variável de ambiente commitada ou resposta de API.** Fora do ambiente local, secrets vêm das variáveis de ambiente da plataforma de hospedagem, nunca de arquivo versionado. A conta Stellar do Access assina e patrocina com o mesmo modelo em todos os ambientes (D-24, ADR-010), e o OpenZeppelin Relayer segue como alvo para gas em produção (D-02). Habilitar Pubnet/USDC é uma etapa explícita — nunca liberar production por inferência.
6. **Todo endpoint que recebe webhook valida assinatura HMAC antes de processar qualquer coisa.** Sem exceção, mesmo em ambiente de desenvolvimento.
7. **O Access nunca recebe nem movimenta recurso de terceiro (RN-009, D-09).** Todo dinheiro passa pela BlindPay: payin entrega direto na wallet do produtor, saque é payout da BlindPay, taxa do Access é partner fee. Nunca criar conta, wallet ou fluxo que receba em nome do produtor — é a regra anti-nesting da BlindPay.
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

### Fluxo de Git

1. **Implementação começa numa branch nova**, criada a partir da `main` atualizada e nomeada com os prefixos da tabela acima. Ao final, commitar e abrir PR para a `main` (`gh pr create`).
2. **Docs e specs vão direto na `main`, sem PR**, nesta fase de desenvolvimento — commit e push após a mudança aprovada. Commits sempre em Conventional Commits.
3. **Autoria é sempre do Matheus.** Commits usam a identidade git configurada localmente — nunca alterar `user.name`/`user.email` nem passar `--author`.
4. **O Claude nunca aparece como autor ou coautor.** Nada de `Co-Authored-By`, "Generated with Claude Code" ou qualquer menção de autoria do Claude em mensagens de commit ou descrições de PR.

O repositório já reforça a regra 4 em duas camadas: `.claude/settings.json` desliga a atribuição automática, e `.githooks/commit-msg` remove trailers residuais — este último só funciona com `git config core.hooksPath .githooks` ativo no clone.

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
pnpm test:integration             # turbo com --concurrency=1: as suítes compartilham banco e Redis
docker compose -f docker-compose.test.yml down

# Qualidade
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo format -- --check

# Contratos Soroban (Caatinga, D-25) — a partir de packages/contracts
cargo test --locked                       # Linux/macOS e CI
pnpm contract:test:docker                 # Windows: as crates da OpenZeppelin passam do limite de exports de DLL
pnpm exec ctg build ticket
pnpm exec ctg deploy ticket --network testnet --source <identidade> --no-generate
pnpm exec ctg upgrade ticket --network testnet --source <identidade>

# Banco de dados
pnpm db:generate                  # gera Prisma Client após mudança de schema
pnpm db:migrate                   # aplica migrations

# Frontend e design (docs/design/README.md)
pnpm --filter @access/ui tokens   # gera tokens.css a partir de packages/ui/tokens/figma-tokens.json
pnpm --filter @access/web dev     # app em http://localhost:3000 (catálogo em /dev/catalog)
pnpm --filter @access/web capture dev/catalog catalog   # capturas em 360 e 1440 (rota sem a barra inicial)
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
├── 06-sdd/                             ← especificações de implementação, comece aqui
│   ├── MVP-REVISADO.md                 ← fonte de verdade da arquitetura
│   ├── OVERVIEW.md
│   └── SPEC-*.md
├── design/                             ← processo de design, mapa Figma ↔ código
└── _archive/                           ← documentação superada, só histórico

apps/
├── api/         NestJS — API REST + SSE (uma tela, D-17)
├── web/         Next.js 15 — frontend + PWA de credenciamento
└── workers/     BullMQ — OutboxRelay, MintTicketWorker, NotifyWorker (D-15)

packages/
├── contracts/   Rust + Soroban — TicketContract (extensão do NFT OpenZeppelin, D-03)
├── database/    Prisma schema + migrations
├── shared/      Tipos TypeScript compartilhados
├── ui/          Design System: tema do Tailwind gerado do Figma e componentes shadcn/ui adaptados
└── config/      Configuração de ambiente validada
```

Quando em dúvida sobre onde algo deveria viver, verifique a estrutura de arquivos exata definida na SPEC correspondente antes de decidir por conta própria.

---

## 13. Frontend e design

O design mora no Figma e é decidido aqui, junto com as SPECs. Detalhes em
[`docs/design/README.md`](docs/design/README.md).

- **Fontes:** Design System e telas em `figma.com/design/WYqT9b0lxW4QhWmjuoPblV`; fluxos, regras por
  etapa e perguntas em aberto no FigJam `figma.com/board/2lbuNUP0m7qulZGR9cVALm`.
- **Ordem de leitura antes de uma tela:** `MVP-REVISADO.md` → SPEC de front do fluxo →
  [`docs/design/component-map.md`](docs/design/component-map.md) → o nó do Figma, **relido na hora**.
  O Figma evolui em paralelo; leitura antiga não vale.
- **Pare e pergunte** se o design contradiz a SPEC ou uma regra de negócio.
- **Faltou no Figma (tela, estado, componente, token): resolve no Figma.** Avise o Matheus, ou crie
  seguindo o padrão do arquivo. Nunca invente no código.
- **Nenhum valor solto:** cor, espaço, raio, tamanho, tipografia e efeito vêm dos tokens gerados
  (`packages/ui`), que são o tema inteiro do Tailwind: fora dele a classe não existe. O ESLint barra
  classe fora do tema, valor arbitrário (`p-[13px]`) e cor literal.
- **Componentes partem do shadcn/ui**, adaptados ao Figma (variantes, tamanhos e classes do tema).
  Nunca escrever do zero o que o shadcn resolve; o passo a passo está em `docs/design/README.md`.
- **Componentes em inglês**, ligados ao nome do Figma pelo mapa. Variantes viram props tipadas;
  Hover, Foco e Pressionado são estados de CSS. Componente novo entra no mapa no mesmo PR.
- **Conferência visual obrigatória:** implementar, capturar em 360 e 1440, comparar lado a lado com a
  captura do Figma e registrar no PR o que foi comparado (nós, larguras, resultado). Divergência é
  corrigida antes do PR.
- **Uso do Figma pelo MCP:** ler por nó ou tela (o plano tem limite de chamadas); estrutura de
  páginas e variáveis só por script de leitura (`use_figma`); o código do `get_design_context` é
  referência, adaptado a CSS Modules e tokens.
- **Pronto de front:** além da seção 11, tokens em vez de valores, mapa atualizado, textos do design
  ou da SPEC, estados de foco e desabilitado acessíveis, comparação 360/1440 registrada no PR.

---

## 14. Como trabalhamos

- **Conversar antes de executar.** Decisões abertas vão juntas numa mensagem só, cada uma com
  recomendação e trade-off. Não decidir sozinho o que é do Matheus.
- **Simplicidade.** Não adicionar camada, dependência ou mitigação que o problema não pede. Nomear
  um risco não é licença para desenhar a solução dele.
- **Aprovada a direção, a execução é completa.** Varrer tudo o que a mudança toca (testes, docs,
  mapa, OVERVIEW) sem devolver pendências como "escolha sua".
- **Evidência antes de afirmar.** Rodar, medir, capturar; reportar o que de fato aconteceu, inclusive
  falha.
