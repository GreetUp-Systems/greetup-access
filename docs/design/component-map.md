# Mapa de componentes · Figma ↔ código

Leia antes de implementar qualquer tela. Cada linha liga um componente do
[Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) ao código em `@access/ui`.
Componente ainda não implementado é feito na primeira tela que precisar dele, e entra aqui.

## Implementados

### Button · `packages/ui/src/components/button.tsx` (shadcn/ui)

| Figma            | Nó        | Código                                |
| ---------------- | --------- | ------------------------------------- |
| Botão/Primário   | `29:120`  | `<Button variant="primary">` (padrão) |
| Botão/Secundário | `29:238`  | `<Button variant="secondary">`        |
| Botão/Fantasma   | `29:356`  | `<Button variant="ghost">`            |
| Botão/Destrutivo | `29:474`  | `<Button variant="destructive">`      |
| Botão/Inverso    | `130:312` | `<Button variant="inverse">`          |

| Propriedade no Figma                | Prop                                  |
| ----------------------------------- | ------------------------------------- |
| Tamanho = S · M · L                 | `size="s" \| "m" \| "l"` (padrão `m`) |
| Rótulo                              | `children`                            |
| Ícone esquerdo + troca              | `iconLeft` (ícone `lucide-react`)     |
| Ícone direito + troca               | `iconRight`                           |
| Estado = Carregando                 | `loading`                             |
| Estado = Desabilitado               | `disabled`                            |
| Estado = Hover · Foco · Pressionado | `hover:`, `focus-visible:`, `active:` |

Regras do Figma: no máximo um Primário por tela; Inverso substitui o Primário sobre imagem, câmera
ou vidro, nunca junto dele; Destrutivo sempre com confirmação. No uso, o Inverso também é a ação
neutra de destaque sobre `bg/canvas` e `bg/surface` ("Entrar" do Cabeçalho do site, "Comprar
ingresso", "Começar a vender", "Mostrar ingresso"), e "Sair" da Conta é Destrutivo sem confirmação:
sair não apaga nada (SPEC-016 §6).

Import: `import { Button } from "@access/ui/components/button"`. Com `asChild`, o filho único (um
link) recebe o visual do botão.

Validado em 04/10/2026, já sobre o shadcn/ui: catálogo em 1440 comparado com Primário, Secundário,
Fantasma, Destrutivo e Inverso no Figma (todos os estados).

### Botão de ícone · `button.tsx` (mesmo componente)

| Figma                                           | Nó                          | Código                                                         |
| ----------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| Botão de ícone/Primário · Secundário · Fantasma | `42:63`, `42:124`, `42:197` | `<Button variant="…" size="icon-s \| icon-m \| icon-l">`       |
| Botão de ícone/Vidro, Forma = Círculo           | `91:176`                    | `<Button variant="glass" size="icon-glass">`                   |
| Botão de ícone/Vidro, Forma = Sem fundo         | `91:176`                    | `<Button variant="glass-bare" size="icon-glass">` (na cápsula) |

O ícone vai como filho e o `aria-label` é obrigatório. O Destrutivo (`42:258`) entra quando uma tela
precisar.

### Campo de texto · `field.tsx` + `input.tsx` (shadcn/ui)

| Figma                 | Nó       | Código                                                  |
| --------------------- | -------- | ------------------------------------------------------- |
| Campo de texto        | `44:232` | `<Field>` com `<FieldLabel>`, `<Input>` e ajuda ou erro |
| Tamanho = S · M · L   |          | `<Input size="s" \| "m" \| "l">`                        |
| Texto de ajuda        |          | `<FieldDescription>`                                    |
| Estado = Erro         |          | `aria-invalid` no `Input` + `<FieldError>` (com ícone)  |
| Estado = Desabilitado |          | `disabled` no `Field` e no `Input`                      |

Com ícone (Ícone à esquerda/direita), o campo é o `input-group.tsx` do shadcn/ui: `<InputGroup
size>` com `<InputGroupAddon align="inline-start" | "inline-end">` e `<InputGroupInput>`; a borda e
os estados passam para o grupo. A busca das listas usa S com `size/search-field` (240).

### Lista · `native-select.tsx` (shadcn/ui NativeSelect)

| Figma                                               | Nó                                  | Código                                                                 |
| --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Campo de texto com Ícone à direita = `chevron-down` | `44:232` (`550:16860`, `548:11354`) | `<Field>` com `<FieldLabel>`, `<NativeSelect>` e as opções             |
| Tamanho = S · M · L                                 |                                     | `<NativeSelect size="s" \| "m" \| "l">`                                |
| Texto = "Escolha" (Estado = Padrão)                 |                                     | `<NativeSelectOption value="">`: em `text/tertiary` se for a escolhida |
| Estado = Erro                                       |                                     | `aria-invalid` no `NativeSelect` + `<FieldError>`                      |
| Estado = Desabilitado                               |                                     | `disabled` no `Field` e no `NativeSelect`                              |

A lista nativa do navegador (SPEC-015 R8) com o visual do Campo de texto: Estado, em Seus dados, e
os campos com `items` do pedido de informações. A seta é o `chevron-down` em `icon/secondary`, 16 no
S e 20 no M e no L, e o texto para antes dela. O `className` vai para o invólucro (a largura do
campo); o resto vai para o `<select>`.

### Envio de arquivo · `file-field.tsx` (composição com o Button)

| Figma                                      | Nó                                         | Código                                                                   |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Envio de arquivo                           | `253:371`                                  | `<FileField state title detail fileName error accept onFileSelect>`      |
| Estado = Vazio · Enviando · Enviado · Erro | `253:286`, `253:309`, `253:326`, `253:348` | `state="empty" \| "uploading" \| "sent" \| "error"`                      |
| Título · Detalhe                           |                                            | `title` · `detail` (os formatos); enviado, `fileName`; com erro, `error` |
| Ação "Escolher" · "Trocar"                 |                                            | Botão/Secundário S (vazio e erro) · Botão/Fantasma S (enviado)           |

Uma linha por arquivo (documentos da verificação, pedido de informações). O ícone vem do estado:
`upload` em `icon/secondary`, `loader-circle` girando em `icon/accent`, `circle-check` em
`icon/success` e `triangle-alert` em `icon/danger`, num quadro de 40 em `bg/subtle`; com erro, a
borda e a linha ficam `border/danger` e `text/danger`. Enviando mostra "Enviando…" e não tem ação.
O `<input type="file">` fica escondido, fora do Tab e do leitor de tela, com o `accept` do item; o
botão é o controle, com o nome "Escolher" (ou "Trocar") e o título, e a linha é anunciada quando
muda. No celular, o seletor do sistema oferece a câmera ou a galeria (sem `capture`); no desktop,
o arquivo também pode ser solto sobre a linha. Quem recebe o arquivo confere tipo e tamanho
(`app/_lib/producer/onboarding-files.ts`): o `accept` não vale para o arquivo solto.

Validado em 30/10/2026: catálogo em 360 e 1440, nos modos escuro e claro, comparado no Figma com
Envio de arquivo (`253:371`, os quatro estados em 480 de largura, 70 de altura), as linhas de 286 das
telas de Documentos (`545:10328`, `547:11064`, `548:13471`, 110 de altura com o detalhe em três
linhas) e o Estado de Seus dados (`550:16860`, `550:17179`).

### Código de 6 dígitos · `input-otp.tsx` (shadcn/ui)

As caixas de "Identificação · Código" (`145:1506`, `148:2183`): `<InputOTP>` com `<InputOTPGroup>` e
seis `<InputOTPSlot>`. Aceita colar e o preenchimento automático do sistema.

### Item de lista · `item.tsx` (shadcn/ui)

| Figma                               | Nó       | Código                                                       |
| ----------------------------------- | -------- | ------------------------------------------------------------ |
| Item de lista                       | `66:322` | `<Item>` com `<ItemMedia>`, `<ItemContent>`, `<ItemActions>` |
| Densidade = Confortável · Compacto  |          | `size="comfortable" \| "compact"`                            |
| Título · Subtítulo                  |          | `<ItemTitle>` · `<ItemDescription>`                          |
| Estado = Selecionado · Desabilitado |          | `selected` · `aria-disabled`                                 |
| Mostrar divisor                     |          | `divider`                                                    |

Com `asChild`, o filho (um botão ou link) vira o item, com hover e foco. O ícone e a seta são
`icon/secondary` (no hover a seta fica `icon/primary`; selecionado, os dois `icon/accent`).

Como lista de opções (o tipo de documento em Documentos · 1, `547:10491` e `547:10342`; SPEC-015
R8), o item é um `<label>` com um `<input type="radio">` escondido: Selecionado é a opção marcada,
com o `check` em `<ItemActions>`, e o foco do rádio desenha a borda interna do item
(`has-focus-visible:`). As setas do teclado andam entre as opções, como em qualquer grupo de rádio.

### Janela · `dialog.tsx` (shadcn/ui)

As janelas sobre a película (`148:1945`, `148:2183`, `176:5744`): `<Dialog>` com `<DialogContent>`,
`<DialogHeader>`, `<DialogTitle>` e `<DialogDescription>`. Abaixo de `md` o mesmo diálogo é tela
cheia, e a tela traz a sua Barra superior.

### Toast · `alert.tsx` (shadcn/ui)

| Figma                                              | Nó       | Código                                                             |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Toast no fluxo da tela                             | `77:527` | `<Alert tone="…">` com `<AlertTitle>` e `<AlertDescription>`       |
| Tom = Sucesso · Neutro · Destaque · Erro · Atenção |          | `tone="success" \| "neutral" \| "accent" \| "danger" \| "warning"` |
| Mostrar ação                                       |          | `action` (um Fantasma S, no fim da sua linha)                      |
| Mostrar fechar                                     |          | `onClose` (Botão de ícone/Fantasma S no lugar de um ícone de 20)   |

O ícone vem do tom. O toast temporário (Sonner) entra quando uma tela usar.

### Barra superior · `top-bar.tsx` (composição)

| Figma            | Nó       | Código                                            |
| ---------------- | -------- | ------------------------------------------------- |
| Tipo = Navegação | `70:318` | `<TopBar type="navigation" title onBack actions>` |
| Tipo = Marca     | `70:318` | `<TopBar type="brand" actions>`                   |
| Tipo = Modal     | `70:318` | `<TopBar type="modal" title onClose>`             |
| Rolagem = Rolado |          | `scrolled`                                        |

Com `actions="loading"`, um esqueleto ocupa o lugar da cápsula enquanto as ações não são
conhecidas (Header · Sessão carregando, `231:5834`).

### Status · `status.tsx` (estilo do Badge do shadcn/ui)

| Figma               | Nó      | Código                                     |
| ------------------- | ------- | ------------------------------------------ |
| Status              | `46:85` | `<Status status="cancelled" size="s">`     |
| Status = 15 estados |         | `status` (o texto e o ícone vêm do estado) |
| Tamanho = S · M     |         | `size="s" \| "m"`                          |
| Mostrar ícone       |         | `showIcon` (desligar só em tabela densa)   |

O texto é fixo por estado, como diz o componente no Figma. Encerrado (`ended`, neutro, ícone
`calendar-check`) é o evento publicado que já aconteceu; o cancelado usa o Cancelado do ingresso.

### Esqueleto · `skeleton.tsx` (shadcn/ui)

O padrão de esqueleto do Figma (Stat Card · Estado = Carregando, `114:74`; Header · Sessão
carregando, `231:5834`): `<Skeleton>` é um bloco `bg/subtle` que pulsa no lugar do que está
carregando. Tamanho e raio vêm de quem usa e são os da coisa substituída, para nada se mover quando
ela chega; sem medida própria, o esqueleto envolve um texto invisível com o mesmo espaço e tipografia.

### Folha · `drawer.tsx` (shadcn/ui)

As folhas de vidro do celular ("Folha · Escolha do ingresso", `139:928`): `<Drawer>` com
`<DrawerContent>`, `<DrawerHeader>` e `<DrawerTitle>`; alça `size/grabber-*`.

### Cartaz · `event-cover.tsx`

A arte padrão da capa do evento (SPEC-014 A2), exportada de `138:322` e `140:931`: tela cheia com
esmaecimento no celular, cartaz de 740 × 440 com `radius/xl` no desktop.

### Pix · `pix.tsx` (composição)

| Figma                                  | Nó       | Código                                                       |
| -------------------------------------- | -------- | ------------------------------------------------------------ |
| Pix                                    | `61:678` | `<Pix state total description code onCopy onRetry retrying>` |
| Estado = Aguardando · Copiado · Falhou |          | `state="awaiting" \| "copied" \| "failed"`                   |

Os textos são do estado e não se reescrevem. Expirado e Pago não aparecem no fluxo (SPEC-014 9C.3):
o pagamento confirmado troca o Pix pela tela Pagamento confirmado, e um Pix vencido chega como
pagamento não concluído (Falhou). O tempo da cotação (Tempo) fica oculto até a validade do Pix ser
medida (A4). Placa e QR em `size/qr-plate` e `size/qr`; o círculo do Falhou em `size/state-circle`
com ícone `size/icon-xl`.

### Ingresso · `ticket.tsx` (composição)

| Figma                                  | Nó       | Código                                                                     |
| -------------------------------------- | -------- | -------------------------------------------------------------------------- |
| Ingresso                               | `56:409` | `<Ticket state eventName dateTime place ticketTypeName code qrValue>`      |
| Estado = Válido · Emitindo · Cancelado |          | `state="valid" \| "issuing" \| "cancelled"` (`59:161`, `59:325`, `59:486`) |

O Topo usa duas artes exportadas do componente: a luz (`ticket-top.svg`), que estica com a largura,
e os arcos (`ticket-arcs.svg`), no tamanho e no lugar do Figma a partir da borda esquerda. A placa do
QR é sempre `brand/creme` com módulos escuros, em qualquer modo; Emitindo mostra o esqueleto
(`ticket-qr-skeleton.svg`) com a Sobreposição (`59:385`). Nas telas de acompanhamento, a coluna
principal do desktop usa `size/content-column` (520).

Cancelado (SPEC-014 9D) põe as duas metades e a perfuração em `border/danger`, tira a luz e os arcos e
troca a placa pelo Carimbo girado 8° (`bg/danger-subtle`, borda `stroke/focus`, Heading/H4): o QR nunca
aparece, mesmo com `qrValue` (M3). Utilizado e Transferido entram com o check-in (SPEC-009) e a
transferência.
As três partes levam `data-slot` (`ticket-top`, `ticket-perforation`, `ticket-base`): o esqueleto do
ingresso aberto (Ingresso · Carregando, `465:7936`) pinta o topo e a base no tamanho deles.

### QR Code · `qr-code.tsx`

`<QrCode value label>`: o QR desenhado no navegador com `qrcode` (SPEC-014 §7), módulos em
`brand/midnight` sobre a placa `brand/creme`. Serve ao Pix e ao ingresso.

### Miniatura · `event-cover.tsx`

`<EventThumbnail src>`: a capa do evento (`coverUrl`, cortada no centro) ou, sem ela, a arte padrão
no tamanho de uma linha (Miniatura, exportada de `150:2252`), `size/thumbnail-s` (56) no celular e
`size/thumbnail-m` (64) a partir de `md`, com `radius/md`. As listas do produtor usam
`size/control-md` (44) e o Próximo evento do Painel, `size/thumbnail-s`, pelo `className`.

### Logo · `logo.tsx`

`<Logo format="horizontal">` ou `format="symbol"` (`3:95`, Versão = Principal), desenhado pelos
limites do nó. O horizontal é SVG em linha: a palavra segue o tema (`text/primary`, SPEC-015 N8) e o
ponto fica `brand/magenta`; os gradientes do símbolo vêm da paleta. O símbolo é o SVG exportado.

Validado em 04/10/2026: catálogo em 1440 comparado no Figma com Botão de ícone/Secundário e Vidro,
Campo de texto, Item de lista, Barra superior e Toast; janela e código nas telas de identificação
(SPEC-014 §5 e §6) em 360 e 1440.

### Avatar · `avatar.tsx` (shadcn/ui)

| Figma           | Nó       | Código                                          |
| --------------- | -------- | ----------------------------------------------- |
| Avatar          | `279:11` | `<Avatar size="s \| m">` com `<AvatarFallback>` |
| Tamanho = S · M |          | `size/avatar-s` (32) e `size/avatar-m` (40)     |
| Iniciais        |          | o texto do `AvatarFallback` (sem foto no MVP)   |

### Tendência · `trend.tsx` (estilo do Badge do shadcn/ui)

`<Trend direction="positive | negative | neutral">12%</Trend>` (`279:208`, Variação = Positiva ·
Negativa · Neutra). A seta acompanha a cor, e a direção também é lida pelo leitor de tela.

### Aba de seção · `tabs.tsx` (shadcn/ui)

`<Tabs>`, `<TabsList>`, `<TabsTrigger value count>` e `<TabsContent>` (`283:18`): só a variante de
linha, com a contagem na cápsula e o sublinhado `stroke/indicator` na selecionada.

### Controle segmentado · `segmented-control.tsx` (shadcn/ui Tabs)

| Figma               | Nó        | Código                                                      |
| ------------------- | --------- | ----------------------------------------------------------- |
| Controle segmentado | `154:520` | `<Tabs value onValueChange>` + `<SegmentedControl>`         |
| Opção               |           | `<SegmentedControlItem value>`, a vista em `<TabsContent>`  |
| Selecionada = 1 · 2 |           | `data-[state=active]`, a lente (`glass/lens` + `glass/rim`) |

Duas vistas da mesma lista (Próximos e Anteriores, SPEC-014 M2): é a lista de um Tabs, com a semântica
de abas e as setas do teclado. Ocupa a largura do conteúdo no celular; no desktop, ao lado do título,
`size/segmented-control` (328). Hover segue a Aba de seção; pressionado e foco, a Barra de abas.

### Cartão de evento · `event-card.tsx` (composição)

| Figma                                  | Nó                  | Código                                                                         |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| Tipo = Destaque                        | `154:521`           | `<EventCard type="feature" title date place countdown badges coverUrl action>` |
| Tipo = Destaque largo                  | `468:70`            | `type="wide"` + `secondaryAction` ("Ver evento")                               |
| Tipo = Linha                           | `154:562`           | `<EventCard type="row" state title detail tickets coverUrl>`                   |
| Estado = Padrão · Anterior · Cancelado | `480:49`, `154:586` | `state="default" \| "past" \| "cancelled"` (Utilizado vem com o check-in)      |
| Mostrar capa                           |                     | `coverUrl`; `null` mostra a arte da marca                                      |
| Mostrar ação · Mostrar ver evento      |                     | `action`, `secondaryAction` (Botão/Inverso L, Botão/Fantasma L)                |

Os eventos de Meus ingressos (SPEC-014 M1, M6). Destaque: a arte no topo com `size/card-art` (172) de
altura e a Contagem em vidro sobre ela. Destaque largo: o próximo evento no desktop, a arte com
`size/feature-art` (560) ao lado. Linha: a Miniatura, o título e o detalhe; Anterior e Cancelado
esmaecidos, e o Cancelado com o Status. Sem capa, a arte da marca exportada do componente com Mostrar
capa desligada (`cover-card.svg`, `cover-feature.svg` e a Miniatura). Selos e Contagem são cápsulas
`size/status-m` com `space/2-5` nas laterais. Com `asChild`, o filho único (um link) vira o cartão,
que abre por inteiro (M7), com o foco de `border/accent`; `heading` dá o nível do título.

### Carrossel e Ponto de paginação · `carousel.tsx` (shadcn/ui Carousel, embla)

| Figma                   | Nó               | Código                                                                          |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------- |
| (sem componente)        |                  | `<Carousel opts onSelectedIndexChange>`, `<CarouselContent>`                    |
|                         |                  | `<CarouselItem>`                                                                |
| Ponto de paginação      | `480:10`         | `<CarouselDots>`                                                                |
| Estado = Atual · Padrão | `480:8`, `480:9` | `size/dot-active` × `size/dot` em `text/primary`; `size/dot` em `text/tertiary` |

Desliza entre os ingressos do evento no celular (SPEC-014 M11), um por vez, e anda com as setas do
teclado: o carrossel é uma parada do Tab, com o foco de `border/accent`. Sem as setas do shadcn por enquanto: a vitrine as traz na SPEC-016 16C. Os pontos ficam numa
linha com `space/1-5` entre eles e são decorativos: a legenda da tela diz qual ingresso está à vista.

### Progresso · `progress.tsx` (shadcn/ui)

`<Progress value={0..100}>` (`283:19`): vendidos sobre capacidade, `bg/accent` sobre `bg/subtle`.

### Menu da conta e Item de menu · `dropdown-menu.tsx` (shadcn/ui)

| Figma                       | Nó         | Código                                                         |
| --------------------------- | ---------- | -------------------------------------------------------------- |
| Menu da conta               | `365:461`  | `<DropdownMenuContent>` (`w-sidebar` no menu da conta)         |
| Cabeçalho (avatar, nome)    |            | `<DropdownMenuLabel>`                                          |
| Separador                   |            | `<DropdownMenuSeparator>`                                      |
| Item de menu                | `281:312`  | `<DropdownMenuItem>` com ícone Lucide e rótulo                 |
| Estado = Hover · Destrutivo |            | realce do Radix (`data-highlighted`) · `variant="destructive"` |
| Ações do evento             | `410:3081` | `<DropdownMenuContent className="w-menu">` (`size/menu`)       |
| Menu do período             | `407:3075` | `<DropdownMenuRadioGroup>` com `<DropdownMenuRadioItem>`       |

Contexto = Painel no sistema do produtor (`AccountMenu`, `apps/web/app/_components/producer`) e
Contexto = Site na moldura do site (`SiteAccountMenu`, `apps/web/app/_components/site`): `365:246`
para quem compra, só com a inicial e o e-mail (S3), e `365:260` para quem também produz, com as
iniciais, o nome público e o e-mail. O menu do site abre abaixo do avatar, alinhado à direita dele.
Na Folha · Conta (`293:2785`) o mesmo Item de menu tem 44 de altura e é um link comum:
`menuItemVariants({ size: "m" })`.

### Tabela · `table.tsx` (partes do shadcn/ui Table)

As tabelas do sistema do produtor (Eventos `307:2983`, os eventos do Painel, os tipos de ingresso):
`<Table>` com `<TableHeader>` (a linha `bg/subtle` com `<TableHead>` em Label/S), `<TableBody>`,
`<TableRow>` e `<TableCell>`. Não é componente no Figma: as telas desenham com quadros. As linhas
são flex com os papéis de tabela, para a linha inteira ser o link do evento; cada divisor tem 12 de
cada lado. As colunas usam `size/column-s` (120), `column-m` (140), `column-l` (180) e
`column-xl` (200); a coluna sem largura ocupa o resto.

### Barra lateral · `sidebar.tsx` (shadcn/ui Sidebar, flutuante e recolhível em ícones)

| Figma                               | Nó        | Código                                                       |
| ----------------------------------- | --------- | ------------------------------------------------------------ |
| Barra lateral, Recolhida = Não, Sim | `282:572` | `<SidebarProvider defaultOpen>` com `<Sidebar>` (⌘B, cookie) |
| Topo · Navegação · rodapé           |           | `<SidebarHeader>` · `<SidebarContent>` · `<SidebarFooter>`   |
| Item de navegação                   | `280:289` | `<SidebarMenuButton isActive tooltip>` no `<SidebarMenu>`    |
| Selo (contagem)                     |           | `<SidebarMenuBadge>`                                         |
| Conta na barra lateral              | `281:292` | `<SidebarAccountButton initials name email>`                 |
| Alça da barra lateral               | `281:369` | `<SidebarTrigger>`                                           |

Abaixo de `md` a barra não aparece: o celular usa a Barra de abas. O item recolhido ganha
tooltip (`tooltip.tsx`, só no código, como pede a descrição do Item de navegação).

### Barra de abas · `tab-bar.tsx` (composição)

`<TabBar>` com `<TabBarItem selected asChild>` (`73:376` e `73:39`): cápsula de vidro fixa no pé do
celular; selecionada com a lente e a cor de destaque, pressionada só com a lente, foco com o anel
interno. Ícones sempre preenchidos (`fill-icons.tsx`). O Selo da aba entra quando uma tela usar.
No sistema do produtor, Painel · Eventos · Recebimento; no site (`SiteTabBar`), Início · Ingressos ·
Conta, com `HouseFill`, `TicketFill` e `UserFill` (Mobile · Conta, `300:4512`).

### Cabeçalho do site · `apps/web/app/_components/site/SiteHeader.tsx` (composição)

| Figma                                     | Nó         | Código                                                         |
| ----------------------------------------- | ---------- | -------------------------------------------------------------- |
| Cabeçalho do site                         | `316:171`  | `<SiteHeader account onSignIn onSignOut>`, só a partir de `md` |
| Sessão = Visitante · Comprador · Produtor |            | `account` (`SiteAccount`: visitante, quem compra, quem produz) |
| Mostrar busca · Mostrar Para produtores   |            | ainda não existem no código: entram com a 16C e a 16D (S5)     |
| Header · Sessão carregando                | `231:5834` | `account` carregando: o esqueleto de "Entrar" no fim da coluna |

O logo leva ao Início; "Entrar" é Inverso M; "Meus ingressos" é Fantasma M com `Ticket`; "Painel do
produtor", Secundário M com `LayoutGrid`; o avatar S num alvo de 44 abre o Menu da conta (Site). No
celular, a página do evento usa a Barra superior/Marca, e a área do comprador, a Barra de abas.

### Rodapé do site · `apps/web/app/_components/site/SiteFooter.tsx` (composição)

`<SiteFooter>` (`316:234`, Formato = Desktop): a marca em `size/footer-brand` (320), as colunas de
links e a base com o crédito dos pagamentos. "Mostrar Explorar eventos" e "Mostrar Access" ficam
desligados até o Explorar (16C) e os termos (S16); o Formato = Celular entra com o Início.

### Cabeçalho do checkout · `apps/web/app/_components/checkout/CheckoutHeader.tsx` (composição)

`<CheckoutHeaderView email onSignIn onAccount>`: o cabeçalho focado do checkout no desktop
(Navegação de `150:2242`), o logo e a conta ("Entrar" ou o e-mail, Fantasma M) (SPEC-016 S20).

### Etapa · `step.tsx` (composição com o Button)

`<Steps>` com `<Step state number title detail action showLine>` (`294:71`):
`state="done" | "current" | "in_progress" | "pending" | "error"` (Concluída, Atual, Em andamento,
Pendente, Erro).

Validado em 08/10/2026: catálogo em 1440, nos modos escuro e claro, comparado no Figma com Avatar,
Tendência, Aba de seção, Progresso, Menu da conta (Painel), Item de menu, Barra lateral
(aberta e recolhida), Item de navegação, Conta na barra lateral, Barra de abas (3 abas) e Etapa.

## Ícones

Página "Ícones" (`27:2`): 47 ícones, dos quais 43 são Lucide com o mesmo nome (`Ícone/ticket` →
`Ticket` de `lucide-react`), traço 1,75, tamanhos `size/icon-sm` (16), `size/icon-md` (20) e
`size/icon-lg` (24). Os `*-fill` são próprios e vão para `fill-icons.tsx`, exportados do Figma com o
preenchimento em `currentColor`, quando a primeira tela precisar: já estão `layout-grid-fill`,
`calendar-fill` e `wallet-fill` (Barra de abas do sistema do produtor) e `house-fill`,
`ticket-fill` e `user-fill` (Barra de abas do site); falta `qr-code-fill`.

## Ainda não implementados

| Figma                     | Nó do conjunto | Variantes                                                                     |
| ------------------------- | -------------- | ----------------------------------------------------------------------------- |
| Botão de ícone/Destrutivo | `42:258`       | Tamanho × Estado                                                              |
| Card                      | `51:358`       | Tipo × Estado × Espaço                                                        |
| Ingresso (restante)       | `56:409`       | Estado (Utilizado, Transferido)                                               |
| Stat Card                 | `114:184`      | Estado × Variação × Tamanho                                                   |
| Resultado do leitor (UX)  | `119:447`      | Estado (Verificando, Válido, Já utilizado, Inválido, Cancelado, Outro evento) |

## Telas

Página "App" (`267:2`): o sistema do produtor, com o Painel e seus estados, Eventos, o Perfil do
produtor, a conta (menu e folha), a barra recolhida e os estados de carregamento, erro e vazio, em
360 e 1440 (o Painel também no modo claro). Os IDs de cada quadro estão na
[SPEC-015](../06-sdd/SPEC-015-web-producer.md) §5.1.

Página "Compra" (`138:321`): página do evento, escolher ingresso, identificação (e-mail e código),
revisar pedido, Pix, pagamento confirmado e ingresso pronto, cada uma em 360 e 1440, mais os estados
de borda (indisponível, valor mínimo, esgotou, total mudou, pagamento não concluído, erro de conexão
e entrar). Os IDs de cada quadro estão na [SPEC-014](../06-sdd/SPEC-014-web-purchase.md) §5 e §6.

Página "Site público" (`325:2`): Início, Para produtores, Explorar, a área do comprador (Meus
ingressos, o ingresso e a Conta, de quem compra e de quem também produz) e a proposta da página do
evento com o Cabeçalho do site, em 360 e 1440. Os IDs de cada quadro estão na
[SPEC-016](../06-sdd/SPEC-016-web-public-site.md) §5.1.
