# Arquitetura de informação

> **Status:** aprovada em 07/10/2026. Duas camadas: o site público e o sistema do produtor (D-29).
> Substitui a navegação única aprovada mais cedo no mesmo dia (§8).

Como o web se organiza: as camadas, a navegação de cada uma, o que cada página mostra e onde cada
SPEC entra. Toda tela nova nasce dentro desta estrutura; uma SPEC que traz uma função nova diz onde
ela mora.

## 1. Princípios

- **Duas camadas, uma conta.** O site público é aberto a todos: vitrine, eventos, compra e a área de
  quem compra. O sistema do produtor só aparece depois do login e do perfil de produtor. A mesma
  conta (D-20) passa de uma camada à outra pelo menu da conta.
- **Navegação só com o que existe.** Um item entra quando a função dele chega. Não há item
  "em breve".
- **Quem está logado sempre à vista.** No site, o avatar no cabeçalho (desktop) e a aba Conta
  (celular); no sistema do produtor, a conta no rodapé da barra lateral e o avatar no topo do
  celular. Os dois menus têm "Sair".
- **O comprador aparece pelo e-mail.** O Access não guarda nome de comprador (SPEC-002). Quem também
  produz aparece pelo nome público do perfil.
- **Fluxos focados ficam sem navegação.** Checkout e Criar perfil têm só o logo e a saída.
- **O início de cada camada responde "o que eu faço agora".** No site, o que está à venda; no
  sistema do produtor, as pendências, depois os números.

## 2. Site público

### Desktop: Cabeçalho do site

| Parte    | O que tem                                                                             |
| -------- | ------------------------------------------------------------------------------------- |
| Esquerda | Logo (leva ao Início) e a busca com a cidade                                          |
| Direita  | Visitante: Para produtores e Entrar                                                   |
|          | Quem compra: Para produtores, Meus ingressos e o avatar                               |
|          | Quem também produz: Meus ingressos, Painel do produtor e o avatar                     |
| Conta    | Menu da conta: Meus ingressos, Conta, Vender ingressos (ou Painel do produtor) e Sair |

O rodapé repete os caminhos: para quem compra, para quem produz e os termos.

### Celular: Barra de abas

**Início · Ingressos · Conta.** Para visitante, Ingressos e Conta levam a "Entrar". O topo do Início
tem o logo, "Entrar" (ou o avatar), a cidade como seletor e a busca com o botão de filtros. Ficam
sem abas: o checkout, o seletor de cidade, a folha de filtros e Para produtores, que tem a barra
fixa "Começar a vender".

## 3. Sistema do produtor

### Desktop: barra lateral (Sidebar do shadcn)

Painel flutuante de 256 px (`size/sidebar`), recolhível para só ícones (72 px,
`size/sidebar-collapsed`, ⌘B), com o logo, **Painel**, **Eventos** (com contagem) e
**Recebimento**; Check-in entra com a SPEC-009. No rodapé, a conta (avatar, nome público, e-mail),
com o menu: Perfil do produtor, Meus ingressos, Ir para o site e Sair.

### Celular: Barra de abas

**Painel · Eventos · Recebimento.** O avatar no topo abre a conta numa folha, com os mesmos itens
do menu. Perfil do produtor e as etapas do Recebimento (termos, dados, documentos) abrem como
páginas internas, com voltar e sem abas.

### Entrada

"Começar a vender" (site) → Entrar, se preciso → Criar perfil (focado, sem navegação) → Painel. Quem
já produz entra pelo "Painel do produtor" do cabeçalho ou do menu da conta.

## 4. Mapa

```
Site público
├── /                          Início                                   SPEC-016
├── /explore                   Explorar (busca e filtros)               SPEC-016
├── /e/[slug]                  Página do evento e escolha do ingresso   SPEC-014
├── /checkout/[purchaseId]     Revisão, Pix, acompanhamento (focado)    SPEC-014
├── /producers                 Para produtores                          SPEC-016
├── /me/tickets                Meus ingressos                           SPEC-014 9D
├── /me/tickets/[id]           O ingresso com QR                        SPEC-014 9D
└── /me                        Conta                                    SPEC-016

Sistema do produtor
├── /producer                  Painel                                   SPEC-015
├── /producer/start            Criar perfil (focado)                    SPEC-015
├── /producer/events           Eventos                                  SPEC-015
├── /producer/events/new       Novo evento                              SPEC-015
├── /producer/events/[id]      Editor, tipos de ingresso, publicação    SPEC-015
├── /producer/receiving        Recebimento                              SPEC-015
├── /producer/profile          Perfil do produtor                       SPEC-015
└── Check-in                   Leitor                                   SPEC-009
```

## 5. Páginas de entrada

- **Início (`/`).** Destaques em carrossel, categorias, "Eventos em [cidade]" com os filtros de
  data e preço aplicados ali mesmo, a faixa para produtores, as cidades com mais eventos e os
  recém-anunciados.
- **Explorar (`/explore`).** Os mesmos filtros, completos (§6), com a contagem de resultados, a
  grade (desktop) ou a lista (celular) e o estado sem resultado com sugestões.
- **Meus ingressos (`/me/tickets`).** O próximo evento em destaque e os demais; abas Próximos e
  Anteriores.
- **Conta (`/me`).** E-mail de acesso, perfil de produtor (ou "Vender ingressos") e Sair.
- **Painel (`/producer`).** Saudação e data, período e "Criar evento"; depois os avisos (vendas
  pausadas, pedido de informações, tudo pronto), as pendências da configuração, a visão geral com
  tendência e o gráfico, o próximo evento, as vendas recentes (sem dados de quem comprou) e os
  eventos em abas.

## 6. Busca e filtros

- **Onde.** "Todo o Brasil" por padrão; a cidade escolhida vale para o site inteiro e fica salva no
  navegador. A lista só traz cidades da base do IBGE com evento à venda, com a contagem. "Usar minha
  localização" escolhe a cidade com eventos mais próxima.
- **Quando.** Qualquer data, Hoje, Amanhã, Este fim de semana, Esta semana, Este mês e Escolher
  datas.
- **Categoria.** Lista fixa; só aparecem as que têm resultado.
- **Preço.** Faixas fixas; a faixa sem resultado fica desabilitada.
- **Ordenar.** Data (padrão) ou mais vendidos.
- **Contagem.** Cada opção mostra quantos eventos traz, já combinada com os outros filtros. No
  celular, a folha de filtros termina em "Mostrar N eventos". Sem resultado, a página sugere tirar um
  filtro, com a contagem de cada sugestão.

## 7. No Figma

- **Telas:** página "Site público" (seções Início, Para produtores, Explorar, Área do comprador e
  Proposta · Página do evento); página "App" (sistema do produtor: Painel e estados, Eventos, Perfil
  do produtor); página "Produtor" (Criar perfil, Recebimento e Evento); página "Compra" (evento e
  checkout). Os nós de cada tela estão nas SPECs 015 e 016.
- **Componentes:** Vitrine (Cartão da vitrine, Destaque da vitrine, Chip de filtro, Categoria);
  Filtros (Opção, Filtro de cidade); Site (Cabeçalho do site, Busca do site, Rodapé do site,
  Pergunta); Folha (Cabeçalho da folha, Barra de ações); Envio de arquivo (Envio de capa); Barra
  lateral (Barra lateral, Menu da conta com as variantes Painel e Site).
- **Modo claro:** "Desktop · Início (claro)" e "Desktop · Painel (claro)" trocam o modo da coleção
  Color; capas e cartões de cidade ficam sempre escuros.

## 8. Considerada e descartada: navegação única

Um só app logado, com Ingressos e o grupo Vendas na mesma barra lateral, aprovado de manhã em
06/10/2026. Revisto no mesmo dia: quem compra precisa de uma vitrine pública para achar eventos, e o
produtor só entra no sistema depois do login e do perfil. Misturar os dois deixava a vitrine sem
lugar e punha a área de vendas na frente de quem só compra.
