# SPEC-015 — App web · Sistema do produtor

> **Status:** aprovada em 07/10/2026
>
> **Versão:** 1.3 (15B sem busca ⌘K; 1.2: motivo da recusa só pelos `kyc_warnings`, regras da
> capa, erros do backend)
>
> **Atualizada em:** 08/10/2026
>
> **Depende de:** SPEC-003 (onboarding do produtor), SPEC-004 (eventos), SPEC-005 (compras),
> SPEC-014 (base do web, identificação, assinatura no navegador), SPEC-016 16A (moldura do site, antes
> do 9D) e a [arquitetura de informação](../design/information-architecture.md).

## 1. Objetivo

Dar ao web o sistema do produtor, a camada que só aparece depois do login e do perfil de produtor
(D-29):

1. o esqueleto: barra lateral no desktop (Sidebar do shadcn, com a conta no rodapé e o menu com
   "Sair"), Barra de abas no celular e o Perfil do produtor;
2. o Painel: avisos, pendências, números, gráfico de vendas por dia, próximo evento, vendas
   recentes e eventos;
3. a entrada focada (Criar perfil) e o Recebimento: conta de recebimento (Stellar, assinada no
   navegador, D-28) e a verificação da BlindPay (termos, dados, documentos, pedido de informações e
   recusa);
4. o Evento: lista, criar, editar (com capa, categoria e cidade), tipos de ingresso, publicar e o link
   do evento publicado.

Ao final, um produtor real fica pronto pelo produto, sem script, e a compra de ponta a ponta pode
ser validada (§11). O site público (vitrine, busca, Para produtores, Conta) é a SPEC-016.

## 2. Fontes

- **Estrutura:** [`docs/design/information-architecture.md`](../design/information-architecture.md).
- **Telas:** páginas "App" e "Produtor" do
  [Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) (§5). Releia cada nó antes de
  implementar a tela.
- **Referências de qualidade:** blocos `sidebar-07` e `dashboard-01` do shadcn/ui e as referências
  visuais trazidas pelo Matheus em 06/10/2026.
- **Fluxo, regras e perguntas:** grupo "Fluxo · Onboarding do produtor" do
  [FigJam](https://www.figma.com/board/2lbuNUP0m7qulZGR9cVALm).
- **Componentes:** [`docs/design/component-map.md`](../design/component-map.md).
- **BlindPay:** KYC Standard de pessoa física, termos, RFI e recusa (skill `blindpay`, `kb/kyc.md`).

## 3. Decisões desta SPEC (06/10/2026)

| #   | Decisão                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Duas camadas (D-29): esta SPEC é o sistema do produtor; o site público é a SPEC-016. Só aparece o que existe; Check-in entra com a SPEC-009.                                                                                                                        |
| N2  | Desktop: barra lateral flutuante (Sidebar do shadcn, `variant="floating"`, `collapsible="icon"`, ⌘B), com Painel, Eventos e Recebimento e a conta no rodapé. Celular: Barra de abas Painel · Eventos · Recebimento e o avatar no topo, que abre a conta numa folha. |
| N3  | O menu da conta tem Perfil do produtor, Meus ingressos, Ir para o site e Sair, no desktop e no celular. Meus ingressos e Ir para o site levam ao site público.                                                                                                      |
| N4  | Sem busca ⌘K nem paleta de comandos: a navegação tem três itens e a lista de Eventos tem a própria busca (08/10/2026).                                                                                                                                              |
| N5  | O sistema exige sessão e perfil de produtor. Sem sessão, a identificação da SPEC-014; sem perfil, Criar perfil, numa tela focada (logo e "Voltar ao site", sem a navegação). "Começar a vender", no site, leva até aqui.                                            |
| N6  | O Painel tem ingressos vendidos e vendas com tendência contra o período anterior, o gráfico de vendas por dia e as vendas recentes, sem dados de quem comprou (15A). Gráficos e comparações além disso ficam para a SPEC-012.                                       |
| N7  | Recebimento é item da navegação. No celular, a raiz da aba mostra o estado da verificação (em análise, pendência, recusado, liberando, pronto, erro); termos, dados e documentos abrem como páginas internas, com voltar e sem abas.                                |
| N8  | O logo acompanha o tema: a palavra "Access" usa `text/primary` (no Figma, ajustado; no código, entra na 15B). Hoje ela é branca fixa e some no modo claro.                                                                                                          |
| P1  | Só pessoa física (KYC Standard) no piloto. Empresa (KYB) vem antes da abertura ao mercado (07/10/2026).                                                                                                                                                             |
| P2  | O comprovante de endereço fica fora do formulário (opcional no KYC Standard); se a BlindPay pedir, chega como pedido de informações (RFI).                                                                                                                          |
| P3  | O motivo da recusa é lido na hora da BlindPay, como o RFI, e não é gravado nem logado: só os `kyc_warnings` não resolvidos, com código e mensagem. Os `fraud_warnings` são sinais do modelo de risco, não motivos, e não saem da API (08/10/2026).                  |
| P4  | "Corrigir e enviar de novo" reabre Seus dados com os dados da tentativa recusada, lidos na hora da BlindPay; os documentos são enviados de novo.                                                                                                                    |
| P5  | O detalhe de taxas ao definir o preço (D-27) fica para a SPEC financeira. O preço mostra o mínimo e "A taxa de serviço é paga por quem compra, por cima do preço."                                                                                                  |
| P6  | Cancelar e apagar evento, e apagar tipo de ingresso, ficam fora: o cancelamento ainda não invalida ingressos nem avisa compradores.                                                                                                                                 |
| P7  | Avisos de vendas pausadas e de pedido de informações no Painel, calculados do estado que a API já devolve; sem e-mail.                                                                                                                                              |
| P8  | Componentes novos no Design System (§5.3); tokens novos `size/sidebar` (256), `size/sidebar-collapsed` (72), `size/avatar-s` (32) e `size/avatar-m` (40).                                                                                                           |
| E1  | Capa do evento em 16:9, enviada do navegador direto ao Cloudflare R2 por URL assinada (D-30): JPG, PNG ou WebP até 5 MB; fora de 16:9, a imagem é cortada no centro na exibição. Obrigatória para publicar (07/10/2026).                                            |
| E2  | Categoria do evento, de uma lista fixa: Shows, Festas, Teatro, Stand-up, Esportes, Festivais, Infantil, Cursos e Gastronomia. Obrigatória para publicar.                                                                                                            |
| E3  | Cidade do evento escolhida da base do IBGE (código, nome e UF), separada do endereço, que fica com rua e número. Obrigatória para publicar.                                                                                                                         |

## 4. Entregas

| Parte | Conteúdo                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15A   | Backend: tentativa atual na BlindPay, preço mínimo na visão do evento, vendidos e vendas por evento, resumo de vendas e vendas recentes; capa (R2), categoria e cidade no evento; base de cidades |
| 15B   | Esqueleto: layout do sistema, barra lateral, Barra de abas, conta (menu e folha), Painel (todos os estados), Eventos, Perfil do produtor, logo no tema                                            |
| 15C   | Criar perfil (focado) e Recebimento: conta de recebimento, termos, dados, documentos e resultados da verificação                                                                                  |
| 15D   | Evento: novo, editor (capa, categoria e cidade), tipos de ingresso, publicar e publicado                                                                                                          |

Cada parte é um PR próprio, com a conferência visual 360/1440 registrada. Ordem: 15A → 15B → SPEC-016
16A (moldura do site) → SPEC-014 9D (Meus ingressos, já na moldura) → 15C → 15D → validação real
(§11). O resto da SPEC-016 vem depois da validação.

## 5. Telas, rotas e componentes

### 5.1 Esqueleto e Painel (página "App")

| Tela                                      | Rota                | Celular    | Desktop     |
| ----------------------------------------- | ------------------- | ---------- | ----------- |
| Painel                                    | `/producer`         | `291:2431` | `284:1571`  |
| Painel no modo claro                      | `/producer`         | —          | `287:11368` |
| Menu da conta (desktop) / folha (celular) | sobreposição        | `293:2539` | `288:11539` |
| Barra recolhida                           | —                   | —          | `288:11914` |
| Configuração pendente                     | `/producer`         | `298:4040` | `298:3589`  |
| Primeiro evento (pronto, sem eventos)     | `/producer`         | `299:4266` | `299:3865`  |
| Vendas pausadas                           | `/producer`         | `297:3249` | `297:2973`  |
| Pedido de informações                     | `/producer`         | `297:3789` | `297:3517`  |
| Eventos                                   | `/producer/events`  | `307:3341` | `307:2983`  |
| Perfil do produtor                        | `/producer/profile` | `300:4356` | `300:4078`  |

### 5.2 Criar perfil, Recebimento e Evento (página "Produtor")

| Tela                          | Rota                    | Celular    | Desktop    |
| ----------------------------- | ----------------------- | ---------- | ---------- |
| Criar perfil (focado)         | `/producer/start`       | `305:5771` | `303:4779` |
| Recebimento · Termos          | `/producer/receiving`   | `302:4201` | `301:2818` |
| Recebimento · Seus dados      | `/producer/receiving`   | `302:4286` | `301:3083` |
| Recebimento · Documentos      | `/producer/receiving`   | `302:4468` | `301:3386` |
| Recebimento · Em análise      | `/producer/receiving`   | `302:4594` | `301:3623` |
| Recebimento · Pendência (RFI) | `/producer/receiving`   | `302:4704` | `301:3797` |
| Recebimento · Recusado        | `/producer/receiving`   | `302:4856` | `301:4010` |
| Recebimento · Liberando       | `/producer/receiving`   | `302:4981` | `301:4205` |
| Recebimento · Pronto          | `/producer/receiving`   | `302:5084` | `301:4372` |
| Recebimento · Conta com erro  | `/producer/receiving`   | `302:5193` | `301:4545` |
| Evento · Novo                 | `/producer/events/new`  | `305:5869` | `303:4935` |
| Evento · Rascunho             | `/producer/events/[id]` | `305:6053` | `303:5237` |
| Evento · Tipo de ingresso     | sobreposição            | `305:6304` | `304:5854` |
| Evento · Publicar bloqueado   | `/producer/events/[id]` | `305:6381` | `304:5217` |
| Evento · Publicado            | `/producer/events/[id]` | `305:6633` | `304:5507` |

### 5.3 Componentes

| Figma (página)                                               | Código (shadcn/ui, adaptado)                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| Barra lateral (Barra lateral)                                | `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter` |
| Item de navegação                                            | `SidebarMenuButton` (+ `SidebarMenuBadge`, tooltip recolhido) |
| Conta na barra lateral, Menu da conta (Painel), Item de menu | `NavUser`: `DropdownMenu`, `DropdownMenuItem`                 |
| Alça                                                         | `SidebarTrigger`                                              |
| Avatar, Tendência (Avatar e indicadores)                     | `Avatar`, `Badge`                                             |
| Aba de seção, Progresso                                      | `Tabs` (linha), `Progress`                                    |
| Etapa (Etapas)                                               | composição com `Button`                                       |
| Área de texto (Campo de texto)                               | `Textarea`                                                    |
| Envio de arquivo e Envio de capa (Envio de arquivo)          | `<input type="file">` com `Button`; a capa com prévia         |
| Cabeçalho da folha, Barra de ações (Folha)                   | `Drawer` (vaul) e barra fixa de vidro                         |

Ícones Lucide novos: `upload`, `file-text`, `pencil`, `external-link`, `trash-2`, `layout-grid`,
`wallet`, `panel-left`, `chevrons-up-down`, `arrow-up`, `arrow-down`, `link` e os das categorias
(`music`, `party-popper`, `drama`, `mic`, `trophy`, `tent`, `baby`, `graduation-cap`, `utensils`);
preenchidos das abas: `layout-grid-fill`, `calendar-fill`, `wallet-fill`.

## 6. Comportamento

### Esqueleto

- **Layout do sistema:** exige sessão; sem ela, a identificação da SPEC-014 com `origin: "login"`,
  voltando à página pedida. Sem perfil de produtor (`GET /api/producers/me` → `404
producer_not_found`), vai para `/producer/start`. A barra lateral guarda aberta ou recolhida no
  navegador (cookie do `SidebarProvider`).
- **Estado do produtor:** `GET /api/producers/me`, relido a cada 10 s enquanto alguma etapa espera
  (D-17).
- **Conta:** o menu (desktop) e a folha (celular) levam a `/producer/profile`, `/me/tickets` e `/`;
  "Sair" encerra a sessão Privy e volta ao Início do site.
- **Painel:** com perfil e sem `ready`, a configuração em etapas e "Enquanto isso", com os
  rascunhos. Com `ready`, os números, o gráfico, o próximo evento, as vendas recentes e os eventos.
  Avisos no topo: `compliance_request` com evento publicado → "Vendas pausadas" (erro);
  `approved_rfi` → "A BlindPay pediu informações" (atenção); primeira visita depois da aprovação →
  "Tudo pronto para vender" (sucesso, dispensável). Miniaturas dos eventos usam a capa; sem capa, a
  arte da marca.
- **Período:** Últimos 7, 30 ou 90 dias (30 por padrão); a tendência compara com o período anterior
  de mesma duração.
- **Eventos:** abas À venda, Rascunhos e Encerrados (encerrado: `endsAt`, ou `startsAt`, no
  passado), busca por nome no navegador, colunas evento, data, status, vendidos (com barra) e receita.
- **Perfil do produtor:** nome público (só leitura) e o resumo do Recebimento, com "Ver detalhes".
  No celular, página interna com voltar.
- **Tema:** segue o sistema (claro ou escuro), com os tokens dos dois modos.

### Criar perfil e Recebimento (KYC Standard, pessoa física)

- **Criar perfil:** tela focada (logo e "Voltar ao site"), com as etapas Perfil, Recebimento e
  Evento no topo. `POST /api/producers` com `displayName`; em seguida, sem esperar o produtor, a
  configuração Stellar: `POST /api/producers/onboarding/stellar/activate`; em `signing`, o navegador
  assina o `hashToSign` com `signRawHash` e envia a `.../stellar/activate/signature` (o fluxo da
  conta do comprador, D-28); em `409 activation_signature_stale`, prepara e assina de novo uma vez.
  Pronto o perfil, entra no sistema, no Recebimento.
- **Etapas:** Conta de recebimento, Termos da BlindPay, Seus dados, Documentos e Verificação, em
  linha do tempo (Etapa). Desktop: a lista à esquerda e a etapa à direita; celular: "Etapa N de 4"
  com progresso, e a lista abaixo nos resultados.
- **Conta de recebimento:** "Preparando…" até `stellar.status` ficar ativo. Uma falha vira o toast
  "Conta de recebimento" com "Tentar de novo", sem bloquear a verificação (D-23).
- **Termos:** `POST /api/producers/onboarding/tos` com `redirectUrl` = `/producer/receiving`; volta
  com `tos_id` na URL, que fica no `sessionStorage` até a submissão e sai da URL.
- **Seus dados:** nome, sobrenome, CPF (`taxId`), nascimento, telefone e endereço no Brasil (CEP,
  estado, endereço, complemento opcional, cidade; `country: "BR"`). Ficam só na memória da página até
  o envio; recarregar volta à etapa.
- **Documentos:** tipo (RG → `ID_CARD`, CNH → `DRIVERS`, Passaporte → `PASSPORT`), frente, verso (RG e
  CNH) e selfie, cada arquivo enviado ao ser escolhido (`POST .../files`, PDF, JPG ou PNG até 10 MB);
  no celular, a ação abre a câmera ou a galeria. "Enviar para verificação" chama `POST .../customer`
  (`type: "individual"`, `kycType: "standard"`).
- **Resultados**, por `GET /api/producers/me` (no celular, a raiz da aba Recebimento):

| Estado da API                                                             | Tela                  | O que acontece                                                                                     |
| ------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `compliance.status` `verifying`                                           | Em análise            | "Criar evento" leva ao rascunho                                                                    |
| `compliance.status` `compliance_request` ou `approved_rfi` com RFI aberto | Pendência             | Seções do RFI (`GET .../rfi`) com o texto da compliance como veio; resposta única (`POST .../rfi`) |
| `compliance.status` `rejected`                                            | Recusado              | Motivo lido na hora (15A); "Corrigir e enviar de novo" reabre Seus dados preenchido (P4)           |
| `onboardingStatus` `wallet_registration_pending`                          | Liberando recebimento | O app chama `.../stellar/activate` de novo para registrar a carteira `bw_...`                      |
| `onboardingStatus` `ready`                                                | Pronto                | "Criar evento"                                                                                     |

- **Campos do RFI:** cada seção mostra `title` e `description` sem alteração; campo com `items` vira
  lista; campo de arquivo (chave terminada em `_file` ou `_files`, ou `multiple: true`) vira Envio de
  arquivo; os demais, Campo de texto. `required` e `regex` validam antes do envio; o prazo vem de
  `expiresAt`.

### Evento

- **Novo evento:** nome, categoria, descrição, início e término opcional (data e hora de Brasília,
  enviadas em ISO 8601 com o offset de `America/Sao_Paulo`), local, cidade, endereço, capacidade e
  política de reembolso. "Criar rascunho" chama `POST /api/events` e abre o editor. O cartão "Antes
  de publicar" lista os requisitos.
- **Cidade:** campo de busca com sugestões de `GET /api/cities?query=` (a partir de 2 letras, sem
  acento, 10 resultados, "Nome, UF"); guarda o código do IBGE.
- **Capa:** seção no topo do editor (Envio de capa). Escolhida a imagem, o navegador confere tipo e
  tamanho, pede a URL (`POST .../cover/upload-url`), envia direto ao R2 com progresso e confirma
  (`PUT .../cover`); trocar repete o fluxo; remover, só no rascunho, chama `DELETE .../cover` (o
  evento publicado troca a capa, mas não fica sem ela). Erro de tipo, tamanho ou envio vira o estado
  Erro, com "Escolher outro arquivo".
- **Editor:** caminho "Eventos › nome", status e as ações no cabeçalho ("Salvar alterações" e
  "Publicar evento"; no celular, na Barra de ações). Seções em cartões: Capa, Sobre o evento (nome,
  categoria, descrição), Data e local (início, término, local, cidade, endereço), Ingressos e
  Reembolso; tipos de ingresso em tabela (tipo, preço, quantidade e menu); "Adicionar tipo de
  ingresso" e o menu do tipo abrem a janela do tipo (nome, descrição opcional, preço em reais,
  quantidade), com `POST` ou `PATCH .../ticket-types`. O preço mostra o mínimo
  (`ticketMinPriceCents`) e a frase da taxa (P5).
- **Publicar:** o cartão "Publicação" lista os requisitos (verificação aprovada, capa, ao menos um
  tipo, data no futuro, tipos dentro da capacidade, categoria e cidade). Cumpridos, "Publicar evento"
  chama `POST /api/events/:id/publish`; senão, o botão fica desabilitado com o motivo.
- **Publicado:** "Ver página" no cabeçalho; cartões "À venda" (link `<origem do app>/e/<slug>` e
  "Copiar link") e "Vendas" (vendidos de capacidade e receita).
- **Erros da API → tela:** `422 ticket_price_below_minimum` (com `minimumCents`), `422
ticket_quantity_exceeds_capacity`, `422 event_starts_in_past`, `422 event_not_publishable` (com o
  requisito que falta) e `400 invalid_event` / `invalid_ticket_type` viram o erro do campo; `422
invalid_cover` vira o estado Erro da capa; `409 producer_not_ready` volta ao Publicar bloqueado;
  falha de rede e `503 cover_storage_unavailable`, toast de erro com "Tentar de novo".

## 7. Regras (critérios de aceite)

| Etapa       | Regra                                                                                                | Origem             |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| Acesso      | O sistema só abre com sessão e perfil de produtor; quem só compra fica no site público               | D-29, N5           |
| Navegação   | Só os itens que existem; a conta e "Sair" sempre ao alcance                                          | N1–N3              |
| Painel      | Vendas recentes não mostram nome, e-mail nem nenhum dado de quem comprou                             | RN-010, N6         |
| Perfil      | Um perfil de produtor por conta; o nome aparece como "Organizado por" na página do evento            | SPEC-003, D-20     |
| Conta       | A conta de recebimento é preparada ao criar o perfil, sem depender da verificação; o produtor assina | D-23, D-28         |
| Verificação | Dados e documentos vão direto para a BlindPay; o Access não guarda cópia                             | SPEC-003 §13       |
| Verificação | Recusa cria uma tentativa nova; não se edita cadastro recusado                                       | SPEC-003, BlindPay |
| RFI         | Texto da compliance sem alteração; resposta única; prazo de 27 dias                                  | BlindPay           |
| Rascunho    | Pode ser criado antes da verificação aprovada                                                        | SPEC-004           |
| Capa        | Só JPG, PNG ou WebP até 5 MB, conferidos no R2 antes de valer; a chave é do próprio evento           | D-30, E1           |
| Cidade      | Sempre um município da base do IBGE; o endereço não decide a cidade                                  | D-30, E3           |
| Publicação  | Exige produtor `ready`, capa, categoria, cidade, um tipo, data no futuro e tipos na capacidade       | SPEC-004, E1–E3    |
| Preço       | Mínimo `TICKET_MIN_PRICE_CENTS`; a taxa de serviço é paga por quem compra                            | D-26, SPEC-005     |
| Publicado   | Não volta a rascunho; tipos não podem ser apagados                                                   | SPEC-004           |

## 8. Ajustes de backend (15A)

- **`GET /api/producers/onboarding/customer`:** lê na BlindPay (`GET /customers/{id}`) a tentativa
  atual e devolve `{ status, reasons: [{ code, message }], draft }`. `status` é o `kyc_status` da
  BlindPay; `reasons` são os `kyc_warnings` não resolvidos (código da AiPrise e mensagem em inglês;
  o web mostra o texto em português pelo código), e os `fraud_warnings` ficam fora (P3); `draft`, os
  dados sem arquivo para preencher a nova tentativa (nome, sobrenome, nascimento `YYYY-MM-DD`, CPF,
  telefone, endereço com o país, e o país e o tipo do documento). Nada é gravado nem logado. Sem
  tentativa, `404 blindpay_customer_not_found`; falha da BlindPay, `503
compliance_provider_unavailable` ou `422 customer_fetch_failed`, como no resto do onboarding.
- **SPEC-004, visão privada do evento:** ganha `ticketMinPriceCents` (o valor de
  `TICKET_MIN_PRICE_CENTS`).
- **SPEC-004, `GET /api/events`:** cada evento ganha `soldTickets` (ingressos de compras com
  pagamento confirmado ou emitidas) e `salesCents` (soma dos subtotais dessas compras, sem a taxa
  de serviço), lidos sob a política `purchases_producer_read`.
- **`GET /api/producers/me/sales?period=7d|30d|90d`:** `{ period, tickets, salesCents, previous:
{ tickets, salesCents }, daily: [{ date, tickets, salesCents }] }`, com as mesmas compras do item
  anterior, contadas pela data da confirmação no fuso `America/Sao_Paulo`. `period` é obrigatório;
  `7d` é hoje e os 6 dias anteriores, e `previous` é o período anterior de mesma duração; `daily`
  traz todos os dias do período, do mais antigo ao de hoje, com zero onde não houve venda.
- **`GET /api/producers/me/sales/recent?limit=5`:** as últimas compras confirmadas: `{ eventName,
ticketTypeName, quantity, subtotalCents, confirmedAt }`, `limit` de 1 a 20 (padrão 5). Nenhum dado
  de quem comprou. Consulta fora disso, nas duas rotas: `400 invalid_sales_query`.
- **Cidades:** tabela `cities` (`ibge_code` inteiro, chave; `name`; `uf` de 2 letras), carregada por
  migration a partir da lista de municípios do IBGE (API de Localidades), versionada no repositório.
  `GET /api/cities?query=` (autenticada): busca sem acento pelo início do nome ou de qualquer palavra
  dele, até 10, ordem alfabética; menos de 2 letras, `400 invalid_city_query`.
- **SPEC-004, evento:** ganha `category` (enum `EventCategory`; na API, em minúsculas como os
  estados: `shows`, `parties`, `theater`, `standup`, `sports`, `festivals`, `kids`, `courses`,
  `food`), `cityCode` (FK para `cities`) e `coverKey` (chave no R2), todos opcionais no rascunho.
  Categoria e cidade se trocam, mas não se apagam; código fora da base, `400 invalid_event` com
  `fields: ["cityCode"]`. As visões privada e pública ganham `category`, `city: { code, name, uf }` e
  `coverUrl` (`R2_PUBLIC_BASE_URL` + chave). Publicar sem algum deles → `422 event_not_publishable`
  com `missing` (`cover`, `category`, `city`).
- **Capa:** `POST /api/events/:id/cover/upload-url` com `{ contentType }` (`image/jpeg`,
  `image/png` ou `image/webp`) → `{ uploadUrl, key, expiresAt }`: PUT assinado no R2 por 10 min, com
  `Content-Type` assinado; a chave é `events/<eventId>/<uuid>.<ext>`. `PUT /api/events/:id/cover`
  com `{ key }` confere a chave do evento e o objeto no R2 (`HEAD`: o tipo assinado, até 5 MB) e
  grava `coverKey`; fora disso, `422 invalid_cover`. Só objeto do próprio evento é apagado (tipo ou
  tamanho errado): chave de outro evento é recusada sem tocar no objeto dele. `DELETE
/api/events/:id/cover` limpa a capa do rascunho; no evento publicado, `409 event_cover_required`.
  Trocar ou remover apaga o objeto anterior depois de gravar. Envio abandonado, ou objeto que o R2
  não apagou, fica sem dono no bucket; é aceito. Sem o R2 configurado (só fora de production), as
  três rotas respondem `503 cover_storage_unavailable` e `coverUrl` vem `null`.
- **SPEC-008, `GET /api/me/tickets` e `/:id`:** o evento ganha `coverUrl`, para os cartões de Meus
  ingressos (9D).

## 9. Configuração

Variáveis novas, com entrada no `.env.example`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_PUBLIC_BASE_URL`, as cinco juntas ou nenhuma, obrigatórias
em production. Vazias em development, não há capa e, portanto, nenhum evento publica: testar a
publicação fora do ponta a ponta pede o bucket de desenvolvimento (§11).
`BLINDPAY_ALLOWED_REDIRECT_ORIGINS` precisa incluir a origem do web em cada ambiente (já existe). Os
tokens novos (P8) entram no snapshot `packages/ui/tokens/figma-tokens.json` na 15B.

## 10. Testes

- **Backend (15A):** unitários do mapeamento de avisos e do `draft` (sem arquivos) e da chave da
  capa; integração do endpoint da tentativa (recusada, aprovada, sem tentativa, falha da BlindPay),
  do `ticketMinPriceCents`, dos vendidos e vendas por evento e do resumo e das vendas recentes
  (compras confirmadas, emitidas, pendentes, falhas e de outro produtor; período anterior; fuso;
  nenhum dado de comprador na resposta); cidades (busca sem acento, limite); capa (URL assinada,
  confirmação válida, tipo e tamanho inválidos, chave de outro evento, troca e remoção, com o R2
  simulado); publicação sem capa, categoria ou cidade.
- **Unitários (web):** item ativo da navegação; para onde o layout leva sem sessão e sem perfil;
  estado do Painel a partir do produtor; tendência; etapa atual do Recebimento; campos do RFI; data e
  hora de Brasília → ISO; preço em reais ↔ centavos; validação da capa no navegador; erros da API →
  estado do campo.
- **Ponta a ponta (Playwright, API simulada):** navegação pela barra lateral (aberta e recolhida) e
  pelas abas; menu e folha da conta com "Sair" e com a ida ao site; sem perfil → criar
  perfil → conta de recebimento (assinatura simulada e erro); termos com `tos_id`; dados e
  documentos (com erro de arquivo); em análise, pendência com resposta, recusado com nova tentativa
  preenchida, liberando e pronto; Painel em todos os estados; Eventos; criar rascunho com cidade e
  categoria, capa (envio, erro e troca), tipo abaixo do mínimo, publicar bloqueado, publicar e link do
  publicado.
- **Conferência visual:** cada tela do §5 em 360 e 1440 (e o Painel no modo claro), registrada no PR.

## 11. Validação real

Na Testnet com BlindPay Development e um bucket R2 de desenvolvimento, pelo produto: uma conta nova
cria o perfil, prepara a conta de recebimento (assinatura no navegador) e passa pela verificação
(Development aprova sozinho; nome `Fail` força a recusa); cria um evento com capa, categoria e cidade
e o publica; outra conta compra pelo checkout da SPEC-014, paga o Pix de teste e recebe o ingresso,
que aparece em Meus ingressos e nas vendas recentes do Painel. Fecha o smoke 3C da SPEC-003 e o ponta
a ponta da SPEC-005.

## 12. Fora do escopo

- o site público: Início, Explorar, Para produtores, Conta e a moldura (SPEC-016);
- empresa (KYB) e comprovante de endereço no formulário (P1, P2);
- cancelar e apagar evento, apagar tipo de ingresso (P6);
- detalhe de taxas (D-27), gráficos e comparações além do Painel (SPEC-012), saldo e saque;
- check-in (entra como item da navegação com a SPEC-009);
- e-mails de aviso ao produtor; recorte ou tratamento da capa no servidor; edição do nome público;
  troca manual de tema.

## 13. Definição de pronto

- [ ] Telas do §5 e componentes do §5.3 revisados pelo Matheus.
- [x] 15A: endpoints e campos do §8, com testes (PR #29, 08/10/2026).
- [ ] 15B: esqueleto com conferência visual (360/1440 e modo claro).
- [ ] SPEC-016 16A (moldura do site) e SPEC-014 9D (Meus ingressos) no ar, logo depois da 15B.
- [ ] 15C: Criar perfil e Recebimento com conferência visual.
- [ ] 15D: Evento com conferência visual.
- [ ] Build, lint, typecheck, unitários, integração e ponta a ponta passam.
- [ ] Validação real executada (§11).
