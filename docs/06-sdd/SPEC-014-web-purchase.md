# SPEC-014 — App web · Compra

> **Status:** 9A implementada; 9B a 9D pendentes
>
> **Versão:** 1.0
>
> **Atualizada em:** 04/10/2026
>
> **Aprovada em:** 04/10/2026
>
> **Depende de:** SPEC-004, SPEC-005, SPEC-008 e a ponte de design
> ([`docs/design/README.md`](../design/README.md)).

## 1. Objetivo

Entregar o fluxo do comprador no app web responsivo, do link do evento ao ingresso na conta:
página do evento, escolha do ingresso, identificação por código no e-mail, revisão com a taxa,
Pix, acompanhamento até o ingresso emitido e "Seus ingressos". É também o primeiro uso real do login
Privy no navegador, que valida os fluxos adiados (ativação da conta, e-mail de ingresso pronto).

## 2. Fontes

- **Telas:** página "Compra" do [Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV)
  (§5). Releia cada nó antes de implementar a tela.
- **Fluxo, regras e perguntas:** seção "Access · Fluxo de compra do ingresso" do
  [FigJam](https://www.figma.com/board/2lbuNUP0m7qulZGR9cVALm).
- **Componentes:** [`docs/design/component-map.md`](../design/component-map.md).
- **Backend:** SPEC-004 (evento público), SPEC-005 (compra), SPEC-008 (ingressos, QR e SSE).

## 3. Decisões desta SPEC (04/10/2026)

| #   | Decisão                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | A taxa aparece antes do Pix: a compra passa a ter dois passos no backend, cotação e depois Pix (SPEC-005 v1.5).                                                                   |
| A2  | A página pública ganha término, local em duas partes e disponibilidade por tipo (SPEC-004 v2.2). A capa é a arte padrão da marca; upload de imagem fica com o painel do produtor. |
| A3  | Código legível do ingresso derivado do `tokenId`: `AX-` + 4 dígitos (SPEC-008 v1.3).                                                                                              |
| A4  | Sem contagem regressiva no Pix até a validade do `pix_code` ser medida: a tela mostra só "Aguardando".                                                                            |
| A5  | "Seus ingressos" sem a barra de abas, só com a barra superior; a navegação do app entra com Perfil e as telas do produtor.                                                        |
| B   | Telas que o FigJam prevê e o Figma não tem são desenhadas no Figma, no padrão do arquivo, antes da implementação (§6).                                                            |
| C   | Login Privy sem UI pronta; API chamada direto do navegador; evento renderizado no servidor; sem biblioteca de cache; SSE com `fetch-event-source`; QR gerado no cliente (§7).     |

## 4. Entregas

| Parte | Conteúdo                                                                                      |
| ----- | --------------------------------------------------------------------------------------------- |
| 9A    | Backend: compra em dois passos, página pública ampliada, código do ingresso, CORS             |
| 9B    | Base do web: Privy, cliente de API, cabeçalho, identificação, catálogo dos componentes usados |
| 9C    | Compra: evento, escolha, identificação, revisão, Pix e acompanhamento                         |
| 9D    | Área do comprador: Seus ingressos (próximos e anteriores) e o ingresso                        |

Cada parte é um PR próprio, com a conferência visual 360/1440 registrada.

## 5. Telas e rotas

| Etapa                       | Rota                                                               | Celular    | Desktop    |
| --------------------------- | ------------------------------------------------------------------ | ---------- | ---------- |
| Página do evento            | `/e/[slug]`                                                        | `138:322`  | `140:931`  |
| Escolher ingresso           | `/e/[slug]` (folha de vidro no celular, cartão lateral no desktop) | `139:928`  | `140:931`  |
| Identificação · e-mail      | sobreposição (tela cheia no celular, janela no desktop)            | `145:1422` | `148:1945` |
| Identificação · código      | idem                                                               | `145:1506` | `148:2183` |
| Revisar pedido              | `/checkout/[purchaseId]`                                           | `145:1592` | `150:2242` |
| Pix                         | `/checkout/[purchaseId]`                                           | `146:2348` | `150:2370` |
| Pagamento confirmado        | `/checkout/[purchaseId]`                                           | `146:2411` | `150:2645` |
| Ingresso pronto             | `/checkout/[purchaseId]`                                           | `146:2500` | `150:2755` |
| Seus ingressos · próximos   | `/me/tickets`                                                      | `146:2582` | `150:2853` |
| Seus ingressos · anteriores | `/me/tickets?aba=anteriores`                                       | `157:2067` | `157:2232` |
| Ingresso                    | `/me/tickets/[id]`                                                 | `154:3551` | `156:2434` |

`/checkout/[purchaseId]` é uma tela que evolui sem recarregar (revisão → Pix → confirmado →
pronto), como o FigJam define para "Depois do pagamento". Recarregar a página volta ao estado atual
da compra.

O cabeçalho do desktop tem "Entrar", que abre a mesma identificação com `origin: "login"` e leva a
"Seus ingressos". "Vender ingressos" fica fora desta SPEC (§12). Na 9B, sem tela de produto ainda, o
cabeçalho e a identificação rodam na página `/dev/login` (só em desenvolvimento, como o catálogo),
que serve à conferência visual e à validação real do login; o cabeçalho entra nas rotas da 9C.

## 6. Estados desenhados no Figma (B)

O fluxo previa estes estados sem tela. Foram desenhados em 04/10/2026 na página "Compra", a partir
das telas existentes e só com componentes e variáveis do Design System (linhas em y = 3700 e
y = 4700), e foram revisados no mesmo dia. Os três últimos (código incorreto, reenviar e falha)
vieram na 9B, ao implementar a identificação.

| Estado                  | Celular    | Desktop    | Como aparece                                                                                   |
| ----------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Evento indisponível     | `176:2096` | `176:5567` | Selo "Cancelado" no título; a barra (ou o cartão) diz "Vendas encerradas", sem botão de compra |
| Valor mínimo            | `175:1777` | `176:4873` | Toast de atenção no lugar da nota da taxa; "Continuar"/"Comprar ingresso" desabilitado         |
| Esgotou                 | `175:2013` | `176:5075` | Toast de erro na revisão ("Nada foi cobrado"); ação "Escolher outro"                           |
| Total mudou             | `175:4622` | `176:5200` | Toast de atenção na revisão com o novo total; ação "Gerar Pix"                                 |
| Pagamento não concluído | `175:4806` | `176:5451` | Componente Pix no estado Falhou, com "Tentar novamente" (nova compra)                          |
| Erro de conexão         | `175:4714` | `176:5324` | Toast de erro ("seu pedido continua reservado"); ação "Tentar de novo"                         |
| Seus ingressos vazio    | `176:2209` | `176:5667` | "Nenhum ingresso por aqui" e a explicação                                                      |
| Entrar                  | `176:2292` | `176:5744` | A identificação sem o resumo do pedido, título "Entre no Access"                               |
| Código incorreto        | `188:2785` | `188:2849` | Caixas com borda de erro e "Código incorreto ou expirado." com ícone, como o Campo de texto    |
| Reenviar o código       | `190:2901` | `190:3039` | Depois do contador, Botão/Fantasma S "Reenviar o código", centralizado sob as caixas           |
| Falha na identificação  | `190:2973` | `190:3236` | Toast de erro "Não deu para continuar", no envio do código ou na confirmação                   |

## 7. Arquitetura do app

- **Login:** `@privy-io/react-auth` sem UI pronta (`useLoginWithEmail`): as telas de e-mail e
  código são as do Figma. Depois do código, `POST /api/auth/bootstrap` com `origin: "checkout"` (na
  compra) ou `"login"` (no "Entrar"); no "Entrar", em seguida, `POST /api/me/stellar/activate`, sem
  bloquear a navegação. Sessão ativa pula a identificação.
- **Identificação:** abaixo de 48em, tela cheia com a Barra superior; a partir de 48em, a janela de
  480 sobre a película (`bg/overlay`). A janela é composição do web, não componente do Design
  System. O reenvio do código libera 60 s depois do envio.
- **API:** o navegador chama a API direto com `Authorization: Bearer <access token>`. A API libera
  as origens de `API_CORS_ORIGINS`.
- **Renderização:** `/e/[slug]` é renderizada no servidor (prévia do link compartilhado e conteúdo
  sem JavaScript); as demais telas rodam no cliente.
- **Dados:** cliente de API tipado e hooks simples, sem biblioteca de cache. Erros da API viram
  estados de tela pelo `code` da resposta.
- **Acompanhamento:** `GET /api/purchases/:id/stream` com `@microsoft/fetch-event-source`; ao ver
  `payment_confirmed`, chama `POST /api/me/stellar/activate` uma vez, sem bloquear; em `timeout`,
  passa a consultar `GET /api/purchases/:id`.
- **QR Code:** o do Pix (a partir de `pixCode`) e o do ingresso (a partir de `qrToken`) gerados no
  cliente com `qrcode`, em SVG.
- **Formatação:** valores em real e datas em pt-BR, fuso `America/Sao_Paulo`, por `Intl`.

## 8. Regras (critérios de aceite)

Tiradas da tabela "Regras de negócio em cada etapa" do FigJam, com a origem.

| Etapa         | Regra                                                                                                            | Origem        |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| Evento        | Só evento publicado e com data futura é vendido; cancelado é definitivo e mostra "Evento indisponível"           | SPEC-004      |
| Escolha       | De 1 a 10 ingressos de um tipo por pedido; o contador não passa da disponibilidade                               | SPEC-005      |
| Escolha       | Tipo sem disponibilidade aparece "Esgotado" e não pode ser escolhido                                             | SPEC-004 v2.2 |
| Pedido        | Subtotal mínimo de R$ 10, avisado antes de continuar                                                             | SPEC-005      |
| Identificação | Código por e-mail antes do Pix; não há conta de convidado                                                        | D-21          |
| Revisão       | Uma única linha "Taxa de serviço", paga pelo comprador; sem CPF                                                  | SPEC-005      |
| Revisão       | O total exibido é o que será cobrado; se a cotação mudar, o novo total é mostrado antes de gerar o Pix           | A1            |
| Estoque       | A reserva vale enquanto o Pix puder ser pago; pedido sem Pix libera o estoque em 10 min                          | SPEC-005      |
| Pagamento     | A confirmação vem do webhook da BlindPay; falha ou devolução libera o estoque e mostra "Pagamento não concluído" | SPEC-005      |
| Emissão       | A compra só fica "emitida" quando todos os ingressos saem; a tela mostra "Emitindo" até lá                       | SPEC-005      |
| Conta Stellar | Ativada por intenção e invisível para o comprador                                                                | D-23          |
| Ingresso      | O QR Code só aparece para ingresso emitido e só na área logada                                                   | SPEC-008      |

## 9. Ajustes de backend (9A)

- **SPEC-005 v1.5:** `POST /api/purchases` reserva e cota; `POST /api/purchases/:id/pix` cria o
  Pix, cotando de novo se a cotação venceu e recusando com `409 purchase_total_changed` quando o
  total difere de `expectedTotalCents`.
- **SPEC-004 v2.2:** `endsAt`, `venueName` e `address` no evento; disponibilidade por tipo na
  página pública.
- **SPEC-008 v1.3:** `code` (`AX-0042`) e `event.status` em cada ingresso.
- **CORS:** `API_CORS_ORIGINS` (lista separada por vírgula), obrigatória fora de `development`.

## 10. Configuração

```dotenv
# API
API_CORS_ORIGINS=http://localhost:3000
# Web
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_PRIVY_APP_ID=
```

## 11. Testes

- **Unitários (web):** formatação de valores e datas, agrupamento de ingressos por evento, código
  legível, mapeamento de `code` de erro para estado de tela.
- **Ponta a ponta (Playwright, API simulada por interceptação):** compra feliz até "Ingresso
  pronto"; valor mínimo; esgotado; total mudou; pagamento não concluído; sessão ativa pulando a
  identificação; evento indisponível; seus ingressos vazio, próximos e anteriores.
- **Conferência visual:** cada tela em 360 e 1440 comparada com o nó do §5, registrada no PR.
- **Backend (9A):** unitários e integração dos dois passos, da cotação vencida, do total alterado,
  da disponibilidade pública e do código.
- **Validação real:** login Privy pelo navegador, ativação da conta e uma compra na Testnet com
  BlindPay Development, retomando o smoke adiado da SPEC-005 e o 3C da SPEC-003.

## 12. Fora do escopo

- "Vender ingressos" e todo o fluxo do produtor (onboarding, eventos, check-in);
- barra de abas, Perfil e tema claro selecionável pela interface;
- transferência de ingresso;
- upload de imagem de capa;
- contagem regressiva do Pix (A4);
- PWA e funcionamento offline.

## 13. Definição de pronto

- [x] 9A: dois passos, página pública ampliada, código do ingresso e CORS, com testes.
- [x] Telas do §6 desenhadas no Figma e revisadas pelo Matheus (04/10/2026).
- [ ] 9B: login, identificação e base do app, com conferência visual.
- [ ] 9C: compra de ponta a ponta com a API simulada e conferência visual.
- [ ] 9D: área do comprador com conferência visual.
- [ ] Build, lint, typecheck, unitários, integração e ponta a ponta passam.
- [ ] Validação real na Testnet executada (§11).
