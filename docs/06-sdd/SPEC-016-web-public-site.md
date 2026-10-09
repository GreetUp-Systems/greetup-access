# SPEC-016 — App web · Site público

> **Status:** aprovada em 07/10/2026
>
> **Versão:** 1.1 (recorte da 16A, rodapé, sessão e Conta, revistos em 09/10/2026)
>
> **Atualizada em:** 09/10/2026
>
> **Depende de:** SPEC-004 (eventos e leitura pública), SPEC-005 (disponibilidade e compras),
> SPEC-008 (ingressos do comprador), SPEC-014 (base do web, página do evento, checkout, 9D; a 16A
> vem antes do 9D, que entra na moldura dela), SPEC-015 15A (capa, categoria e cidade do evento) e 15B (Barra de abas e tokens) e a
> [arquitetura de informação](../design/information-architecture.md).

## 1. Objetivo

Dar ao web a camada aberta a todos (D-29):

1. a moldura do site: cabeçalho por sessão, menu da conta, rodapé, Barra de abas no celular e a
   Conta;
2. o Início, com a vitrine: destaques, categorias, eventos da cidade com filtros, cidades e
   recém-anunciados;
3. o Explorar, com busca e filtros que mostram quantos eventos cada opção traz, o seletor de cidade
   e o estado sem resultado com sugestões;
4. a página Para produtores;
5. a página do evento com o cabeçalho do site e a área do comprador, onde a SPEC-014 9D põe Meus
   ingressos.

Quem compra acha o evento sem depender do link do produtor; quem produz chega ao sistema do produtor
(SPEC-015) por "Começar a vender".

## 2. Fontes

- **Estrutura:** [`docs/design/information-architecture.md`](../design/information-architecture.md).
- **Telas:** página "Site público" do
  [Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) (§5). Releia cada nó antes de
  implementar a tela.
- **Componentes:** páginas "Vitrine", "Filtros", "Site" e "Folha" do Design System;
  [`docs/design/component-map.md`](../design/component-map.md).
- **Referências:** Sympla, Eventbrite, Shotgun e Dice (vitrine, filtros e cidade); páginas de produto
  no padrão de SaaS para Para produtores. Trazidas pelo Matheus em 06/10/2026.
- **Textos de Para produtores:** os aprovados em 06/10/2026, conferidos com D-09, D-12, D-26, D-27,
  SPEC-003 (P1 da SPEC-015), SPEC-008 e a documentação da BlindPay.

## 3. Decisões desta SPEC (06/10/2026)

| #   | Decisão                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Duas camadas (D-29). O site é aberto; Meus ingressos e Conta exigem sessão.                                                                                                                                                                                                                  |
| S2  | Cabeçalho por sessão. Visitante: Para produtores e Entrar. Quem compra: Para produtores, Meus ingressos e o avatar. Quem também produz: Meus ingressos, Painel do produtor e o avatar. Menu da conta: Meus ingressos, Conta, Vender ingressos (ou Painel do produtor) e Sair.                |
| S3  | Quem compra aparece pelo e-mail e pela inicial dele: o Access não guarda nome de comprador. Quem também produz aparece pelo nome público e as iniciais.                                                                                                                                      |
| S4  | Celular: Barra de abas Início · Ingressos · Conta. Sem abas: a página do evento, checkout, seletor de cidade, folha de filtros, o ingresso aberto e Para produtores, que tem a barra fixa "Começar a vender".                                                                                |
| S5  | Só o que existe: a busca entra no cabeçalho junto com o Explorar (16C) e "Para produtores" junto com a página (16D). Até lá, o cabeçalho é o da S2 sem a busca e sem "Para produtores".                                                                                                      |
| S6  | Cidade: "Todo o Brasil" por padrão; a escolha vale para o site inteiro, fica no navegador (`localStorage`) e vai na URL do Explorar. A lista só tem cidades com evento à venda, com a contagem. "Usar minha localização" depende de uma base de coordenadas com licença conferida (§13, Q1). |
| S7  | Filtros com contagem combinada: cada faceta conta com os outros filtros aplicados e sem o dela. Categoria sem resultado some; faixa de preço sem resultado fica desabilitada. Sem resultado, até duas sugestões que tiram um filtro, com a contagem.                                         |
| S8  | Busca por texto no nome do evento, no local, na cidade e no nome do produtor, sem acento e sem diferenciar maiúsculas (`unaccent` + `ILIKE`), sem motor de busca externo.                                                                                                                    |
| S9  | A vitrine mostra eventos publicados com `startsAt` no futuro (a compra fecha no início, SPEC-014). Esgotado aparece com o selo; cancelado e rascunho não aparecem.                                                                                                                           |
| S10 | Início: Destaques (até 5) são os eventos com capa mais vendidos nos últimos 7 dias, na cidade escolhida; sem vendas, os próximos com capa. Seção sem conteúdo não aparece.                                                                                                                   |
| S11 | Para produtores usa os textos aprovados; as imagens do produto são capturas das telas do Figma, guardadas como arquivos estáticos e refeitas quando as telas mudam; o valor mínimo vem de `TICKET_MIN_PRICE_CENTS`. A página só vai ao ar com o saque pronto (§13, Q2).                      |
| S12 | A página do evento usa o cabeçalho do site no desktop; o checkout segue com o cabeçalho focado; no celular, só a ação da conta muda (S19) (§13, Q3).                                                                                                                                         |
| S13 | Início, Explorar, Para produtores e a página do evento renderizam no servidor (Next.js), com título, descrição e imagem de compartilhamento (a capa, no evento) por página.                                                                                                                  |
| S14 | Tokens `space/20` (80) e `space/24` (96), para o espaço entre seções do site, já no snapshot desde a 15B; ícones Lucide novos `locate-fixed` e `arrow-up-down` (16C).                                                                                                                        |

### Decisões da 16A (09/10/2026)

| #   | Decisão                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S15 | Tema: o site segue escuro até a 16C. O modo claro do site é decidido com o Início, o único quadro claro dele.                                                                                                                                                                                                                                          |
| S16 | Rodapé só com os caminhos que existem ou chegam antes da validação: "Meus ingressos", "Vender ingressos" e "Painel do produtor". "Explorar eventos" entra na 16C; a coluna Access, quando houver Termos de uso e Política de privacidade. Aparece no desktop da área do comprador; a página do evento e o celular ficam sem rodapé até o Início (16C). |
| S17 | Sem sessão, Meus ingressos e Conta abrem a identificação da SPEC-014 com `origin: "login"` dentro da moldura; depois do código, a pessoa fica na rota pedida, e fechar leva ao Início. O "Entrar" do cabeçalho deixa a pessoa na página em que estava.                                                                                                 |
| S18 | Se `GET /api/producers/me` falha (rede ou 5xx), o cabeçalho, o menu e a Conta tratam a pessoa como quem só compra, sem estado novo.                                                                                                                                                                                                                    |
| S19 | Na página do evento, no celular, a ação da Barra superior é "Conta" (ícone user) e leva a `/me`; sem sessão, é "Entrar".                                                                                                                                                                                                                               |
| S20 | O checkout fica com o cabeçalho focado da SPEC-014: o logo e a conta no desktop; no celular, a barra de cada passo.                                                                                                                                                                                                                                    |
| S21 | A 16A troca só o cabeçalho da página do evento e põe a capa como imagem de compartilhamento (S13). A capa no cartaz entra na SPEC-015 15D, com o envio da capa.                                                                                                                                                                                        |
| S22 | `/` só ganha página com o Início (16C). Até lá, o logo, a aba Início e o "Sair" já apontam para ele, sem página provisória.                                                                                                                                                                                                                            |

## 4. Entregas

| Parte | Conteúdo                                                                                                                                                                                                                                                                                | Quando                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 16A   | Moldura: layout público (cabeçalho por sessão, sem a busca e sem "Para produtores"), menu da conta, rodapé, abas do celular e a Conta; a página do evento com o cabeçalho do site e a capa como imagem de compartilhamento; o layout da área do comprador, onde o 9D põe Meus ingressos | depois da 15B, antes do 9D      |
| 16B   | Backend público: listagem com busca, filtros e facetas; cidades com eventos; dados do Início                                                                                                                                                                                            | depois da validação da SPEC-015 |
| 16C   | Início, Explorar (desktop e celular, folha de filtros, seletor de cidade, sem resultado) e a busca no cabeçalho                                                                                                                                                                         | depois da 16B                   |
| 16D   | Para produtores (desktop e celular) e "Para produtores" no cabeçalho                                                                                                                                                                                                                    | depois da 16C                   |

Cada parte é um PR próprio, com a conferência visual 360/1440 registrada.

## 5. Telas, rotas e componentes

### 5.1 Telas (página "Site público")

| Tela                                  | Rota                         | Celular     | Desktop     |
| ------------------------------------- | ---------------------------- | ----------- | ----------- |
| Início                                | `/`                          | `327:575`   | `325:31`    |
| Início no modo claro                  | `/`                          | —           | `338:14360` |
| Para produtores                       | `/producers`                 | `337:1457`  | `334:1394`  |
| Explorar (desktop com o popover Onde) | `/explore`                   | `358:2380`  | `355:1759`  |
| Explorar · Filtros (folha)            | sobreposição                 | `360:2515`  | —           |
| Explorar · Cidade                     | sobreposição                 | `360:16030` | `355:1759`  |
| Explorar · Sem resultados             | `/explore`                   | —           | `357:2217`  |
| Meus ingressos (9D)                   | `/me/tickets`                | `146:2582`  | `150:2853`  |
| Meus ingressos · Anteriores (9D)      | `/me/tickets?aba=anteriores` | `157:2067`  | `157:2232`  |
| Meus ingressos · Vazio (9D)           | `/me/tickets`                | `176:2209`  | `176:5667`  |
| Ingresso (9D)                         | `/me/tickets/[id]`           | `154:3551`  | `156:2434`  |
| Conta · quem compra                   | `/me`                        | `300:4512`  | `300:4244`  |
| Conta · quem também produz            | `/me`                        | `391:4135`  | `370:13566` |
| Página do evento (proposta, S12)      | `/e/[slug]`                  | —           | `387:4114`  |

Na 16A, o `387:4114` vale pelo cabeçalho; o cartaz com a capa é conferido na SPEC-015 15D (S21).

### 5.2 Componentes

| Figma (página)                                      | Código (shadcn/ui, adaptado)                                  |
| --------------------------------------------------- | ------------------------------------------------------------- |
| Cabeçalho do site, Busca do site (Site)             | cabeçalho com `Input` de busca e o gatilho da cidade          |
| Menu da conta, variantes Site (Barra lateral)       | `DropdownMenu`                                                |
| Rodapé do site, Pergunta (Site)                     | rodapé; `Accordion`                                           |
| Cartão da vitrine, Destaque da vitrine (Vitrine)    | composição com `Card`; `Carousel` (embla) nos destaques       |
| Chip de filtro, Categoria (Vitrine)                 | `Button` com `Popover`; `ToggleGroup` nas datas               |
| Opção, Filtro de cidade (Filtros)                   | `Command` (`CommandInput`, `CommandItem`) dentro de `Popover` |
| Cabeçalho da folha, Barra de ações (Folha)          | `Drawer` (vaul) com cabeçalho e rodapé                        |
| Barra de abas (Barra de abas)                       | `tab-bar.tsx` (SPEC-015 15B), com Início · Ingressos · Conta  |
| Cartão de evento, "Mostrar capa" (Cartão de evento) | o da 9D, com a capa do evento                                 |

## 6. Comportamento

### Moldura (16A)

- **Sessão:** o cabeçalho lê a sessão Privy e `GET /api/producers/me` para saber se a pessoa também
  produz; `404 producer_not_found` é quem só compra, e uma falha conta igual (S18). Enquanto carrega,
  o espaço da conta fica reservado (o estado de sessão carregando da SPEC-014). Sem sessão, a área
  do comprador abre a identificação dentro da moldura (S17).
- **Menu da conta:** Meus ingressos → `/me/tickets`; Conta → `/me`; Vender ingressos →
  `/producers` (até a 16D, `/producer/start`); Painel do produtor → `/producer`; Sair encerra a
  sessão Privy e volta ao Início. Os links já apontam para o destino final, sem página provisória:
  `/me/tickets` passa a existir no 9D, e `/producer/start`, na 15C.
- **Conta:** e-mail de acesso; para quem produz, o perfil de produtor com o nome público e a ida ao
  painel ("Ir para o painel" no desktop, o item "Painel do produtor" no celular); para quem só
  compra, "Vender ingressos" ("Começar a vender" no desktop, o item no celular), que leva a
  `/producer/start`; e "Sair". Os textos são os do Figma em cada largura.
- **Rodapé:** os links e as telas da S16: Meus ingressos → `/me/tickets`; Vender ingressos →
  `/producer/start` (só o do menu muda na 16D); Painel do produtor → `/producer`.
- **Página do evento:** o cabeçalho do site no desktop (S12) e a capa como imagem de
  compartilhamento (S13, S21); no celular, a Barra superior com a
  ação da conta (S19) e sem abas. O checkout fica com o cabeçalho focado (S20).
- **Tema:** escuro até a 16C (S15).
- **Meus ingressos e ingresso:** as telas da 9D, que o 9D põe no layout da área do comprador; os
  cartões usam `coverUrl` do evento e, sem capa, a arte da marca.

### Início (16C)

- **Destaques:** carrossel com até 5 (S10), selo "Em alta", setas e paginação; no celular, deslizar.
- **Categorias:** as que têm evento à venda na cidade escolhida; tocar abre o Explorar filtrado.
- **Eventos em [cidade]:** título com a cidade como seletor; chips de data (Qualquer data, Hoje,
  Amanhã, Este fim de semana, Esta semana, Escolher datas), Preço e Filtros; os chips atualizam a
  grade ali mesmo; 8 eventos por data; "Ver todos os eventos" abre o Explorar com os mesmos filtros.
- **Faixa para produtores:** "Começar a vender" e "Como funciona" levam a `/producers`.
- **Pelas cidades:** as 6 cidades com mais eventos à venda; o fundo é a capa desfocada do evento
  mais vendido de cada uma (sem foto de cidade).
- **Recém-anunciados:** até 4 publicados nos últimos 14 dias, por `publishedAt`.

### Explorar (16C)

- **URL:** `/explore?q=&city=<código IBGE>&when=&from=&to=&category=&price=&sort=`, para compartilhar
  e voltar ao mesmo resultado.
- **Quando,** no fuso `America/Sao_Paulo`: Hoje; Amanhã; Este fim de semana (sexta a domingo
  desta semana; no sábado ou domingo, de hoje até domingo); Esta semana (de hoje até domingo); Este
  mês (de hoje até o fim do mês); Escolher datas (intervalo).
- **Preço,** pelo menor preço à venda do evento: Até R$ 100, R$ 100 a R$ 200, Acima de R$ 200.
- **Ordenar:** Data (padrão) ou Mais vendidos (ingressos dos últimos 7 dias).
- **Desktop:** chips com popover (o de Onde é o Filtro de cidade); filtro aplicado vira chip
  selecionado com ×; "Limpar filtros" quando houver algum; grade de 12 por página com "Carregar
  mais".
- **Celular:** busca no topo, chips em rolagem ("Filtros" com a contagem de filtros ativos), contagem
  de resultados e ordenação; lista em linhas. A folha de filtros reúne Quando, Onde, Categoria e
  Preço e termina em "Limpar" e "Mostrar N eventos", com N atualizado a cada mudança.
- **Seletor de cidade (celular):** busca, "Usar minha localização", "Todo o Brasil" e as cidades com
  eventos, com a contagem.
- **Sem resultado:** título com os filtros ("Nenhum evento hoje em Recife, PE") e até duas sugestões
  (S7), cada uma com a contagem e o link.

### Para produtores (16D)

- Abertura com os CTAs "Começar a vender" (→ `/producer/start`; sem sessão, a identificação antes) e
  "Como funciona" (âncora); benefícios; três passos com as capturas; quanto custa; perguntas
  frequentes; chamada final. No celular, a barra fixa "Começar a vender" some quando a chamada final
  aparece.
- Perguntas e respostas como no Figma; "Existe valor mínimo de ingresso?" lê
  `TICKET_MIN_PRICE_CENTS`.

## 7. Regras (critérios de aceite)

| Tema       | Regra                                                                                          | Origem       |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------ |
| Camadas    | O site é aberto; a área do comprador exige sessão; o sistema do produtor nunca aparece no site | D-29         |
| Identidade | Comprador aparece só pelo e-mail; nenhum nome inventado                                        | S3, SPEC-002 |
| Vitrine    | Só eventos publicados e futuros; esgotado com selo; nenhum dado de quem comprou                | S9, RN-010   |
| Filtros    | Toda contagem bate com o resultado do filtro; opção sem resultado some ou fica desabilitada    | S7           |
| Cidade     | Só cidades da base do IBGE com evento à venda; a escolha vale para o site inteiro              | S6, D-30     |
| Textos     | Nenhuma promessa além do que o produto faz; valores vêm da configuração                        | S11          |
| Navegação  | Só o que existe: busca e Para produtores entram com as páginas                                 | S5           |

## 8. Backend (16B)

Todas as rotas são públicas (`@Public()`) e leem sob a política `events_public_read` (SPEC-004). O que
depende de compras (vendidos, disponibilidade, menor preço à venda, esgotado) sai de funções
`SECURITY DEFINER` de leitura que devolvem só números agregados por evento, como a disponibilidade
da SPEC-004.

- **`GET /api/public/events`** com `q`, `city`, `when` (`today`, `tomorrow`, `weekend`, `week`,
  `month`, `range` com `from` e `to`), `category`, `price` (`lt100`, `100to200`, `gt200`), `sort`
  (`date`, `popular`), `cursor` e `limit` (até 24) → `{ items, nextCursor, total }`. Cada item:
  `{ slug, name, coverUrl, category, startsAt, venueName, city: { code, name, uf }, minPriceCents,
soldOut, producerName }`.
- **`GET /api/public/events/facets`,** com os mesmos filtros → `{ total, when: { today, tomorrow,
weekend, week, month }, categories: [{ category, count }], prices: [{ band, count }] }`; cada
  faceta conta sem o próprio filtro.
- **`GET /api/public/cities?query=&when=&category=&price=`** → as cidades com evento à venda, com a
  contagem, por contagem (sem `query`) ou por nome (com `query`, sem acento).
- **`GET /api/public/home?city=`** → `{ featured, upcoming, recent, cities }`, nas regras do §6;
  `cities` traz, de cada uma, `coverUrl` do evento mais vendido.
- **Índices e extensão:** `unaccent` no Postgres; índices em `events (status, starts_at)`,
  `events (city_code)` e `events (category)`.
- **"Usar minha localização"** depende da Q1 (§13): com coordenadas na tabela `cities`, a rota
  `GET /api/public/cities/nearest?lat=&lng=` devolve a cidade com eventos mais próxima.

## 9. Configuração

Nenhuma variável nova (o R2 vem da SPEC-015). Os tokens da S14 já estão no snapshot
`packages/ui/tokens/figma-tokens.json` desde a 15B; a 16A acrescenta `size/footer-brand` (320, a
marca do rodapé) e `size/account-content` (880, o conteúdo da Conta no desktop), criados no Figma
em 09/10/2026. As capturas de Para produtores ficam em `apps/web/public/` na 16D.

## 10. Testes

- **Backend (16B):** integração da listagem (cada filtro, combinações, busca sem acento, ordem,
  cursor, só publicados e futuros, esgotado), das facetas (cada uma sem o próprio filtro, soma igual
  ao total), das cidades (contagem, busca) e do Início (destaques com e sem vendas, recém-anunciados,
  cidades); nenhum dado de comprador nas respostas.
- **Unitários (web):** intervalos de Quando no fuso de Brasília (inclusive sábado e domingo); faixas
  de preço; URL do Explorar ↔ filtros; sugestões do sem resultado; inicial do avatar a partir do
  e-mail; cabeçalho por sessão (inclusive a falha do perfil).
- **Ponta a ponta (Playwright, API simulada):** cabeçalho e menu da conta por sessão (visitante,
  quem compra, quem produz); Conta e "Sair"; visitante na área do comprador; abas; Início
  (chips filtrando a grade, cidade, categorias); Explorar no desktop (popovers, chips com ×, limpar,
  carregar mais) e no celular (folha com "Mostrar N eventos", seletor de cidade); sem resultado com
  sugestão; Para produtores com "Começar a vender" com e sem sessão.
- **Conferência visual:** cada tela do §5 em 360 e 1440 (e o Início no modo claro), registrada no PR.

## 11. Fora do escopo

- favoritos, avaliações, recomendações por pessoa e mapa;
- páginas próprias de cidade ou categoria para busca orgânica;
- destaques pagos e anúncios;
- e-mails de divulgação;
- busca por artista ou line-up (o evento não tem esses campos).

## 12. Definição de pronto

- [ ] Telas do §5 e componentes do §5.2 revisados pelo Matheus; questões do §13 respondidas em 07/10/2026.
- [ ] 16A: moldura, Conta e a página do evento com o cabeçalho do site e a capa como imagem de
      compartilhamento, com conferência visual
      (Meus ingressos e o ingresso, dentro da moldura, são o 9D da SPEC-014).
- [ ] 16B: rotas do §8, com testes.
- [ ] 16C: Início e Explorar com conferência visual (360/1440 e modo claro).
- [ ] 16D: Para produtores com conferência visual.
- [ ] Build, lint, typecheck, unitários, integração e ponta a ponta passam.

## 13. Questões resolvidas em 07/10/2026

| #   | Questão                                                                                                                  | Resolução                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | "Usar minha localização" precisa das coordenadas de cada município. A lista de Localidades do IBGE não traz coordenadas. | O recurso fica. A 16B confirma uma base pública de coordenadas das sedes municipais e a licença dela; sem base aceitável, a opção sai e a cidade é sempre escolhida na lista. |
| Q2  | Para produtores responde "Como o dinheiro vai para o meu banco?" com o saque, que é da SPEC-011, ainda a reescrever.     | A página só vai ao ar com o saque pronto.                                                                                                                                     |
| Q3  | A página do evento (SPEC-014, implementada) passa a usar o cabeçalho do site no desktop.                                 | Sim: quem chega por link compartilhado ganha a busca e a vitrine. O checkout fica com o cabeçalho focado.                                                                     |
