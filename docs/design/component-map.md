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
ou vidro, nunca junto dele; Destrutivo sempre com confirmação.

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

Ícones dentro do campo (Ícone à esquerda/direita) entram com o `input-group` do shadcn quando uma
tela usar.

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

Com `asChild`, o filho (um botão ou link) vira o item, com hover e foco.

### Janela · `dialog.tsx` (shadcn/ui)

As janelas sobre a película (`148:1945`, `148:2183`, `176:5744`): `<Dialog>` com `<DialogContent>`,
`<DialogHeader>`, `<DialogTitle>` e `<DialogDescription>`. Abaixo de `md` o mesmo diálogo é tela
cheia, e a tela traz a sua Barra superior.

### Toast · `alert.tsx` (shadcn/ui)

| Figma                                              | Nó       | Código                                                             |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Toast no fluxo da tela                             | `77:527` | `<Alert tone="…">` com `<AlertTitle>` e `<AlertDescription>`       |
| Tom = Sucesso · Neutro · Destaque · Erro · Atenção |          | `tone="success" \| "neutral" \| "accent" \| "danger" \| "warning"` |

O ícone vem do tom. Ação e fechar entram quando uma tela usar; o toast temporário (Sonner) também.

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
| Status = 14 estados |         | `status` (o texto e o ícone vêm do estado) |
| Tamanho = S · M     |         | `size="s" \| "m"`                          |
| Mostrar ícone       |         | `showIcon` (desligar só em tabela densa)   |

O texto é fixo por estado, como diz o componente no Figma.

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

| Figma                      | Nó       | Código                                                                         |
| -------------------------- | -------- | ------------------------------------------------------------------------------ |
| Ingresso                   | `56:409` | `<Ticket state eventName dateTime place ticketTypeName code qrValue>`          |
| Estado = Válido · Emitindo |          | `state="valid" \| "issuing"` (Utilizado, Transferido e Cancelado vêm com a 9D) |

O Topo usa duas artes exportadas do componente: a luz (`ticket-top.svg`), que estica com a largura,
e os arcos (`ticket-arcs.svg`), no tamanho e no lugar do Figma a partir da borda esquerda. A placa do
QR é sempre `brand/creme` com módulos escuros, em qualquer modo; Emitindo mostra o esqueleto
(`ticket-qr-skeleton.svg`) com a Sobreposição (`59:385`). Nas telas de acompanhamento, a coluna
principal do desktop usa `size/content-column` (520).

### QR Code · `qr-code.tsx`

`<QrCode value label>`: o QR desenhado no navegador com `qrcode` (SPEC-014 §7), módulos em
`brand/midnight` sobre a placa `brand/creme`. Serve ao Pix e ao ingresso.

### Miniatura · `event-cover.tsx`

`<EventThumbnail>`: a arte padrão no tamanho de uma linha (Miniatura, exportada de `150:2252`),
`size/thumbnail-s` (56) no celular e `size/thumbnail-m` (64) a partir de `md`, com `radius/md`.

### Logo · `logo.tsx`

`<Logo format="horizontal">` ou `format="symbol"` (`3:95`, Versão = Principal), SVG exportado do Figma pelos
limites do nó.

Validado em 04/10/2026: catálogo em 1440 comparado no Figma com Botão de ícone/Secundário e Vidro,
Campo de texto, Item de lista, Barra superior e Toast; janela e código nas telas de identificação
(SPEC-014 §5 e §6) em 360 e 1440.

## Ícones

Página "Ícones" (`27:2`): 47 ícones, dos quais 43 são Lucide com o mesmo nome (`Ícone/ticket` →
`Ticket` de `lucide-react`), traço 1,75, tamanhos `size/icon-sm` (16), `size/icon-md` (20) e
`size/icon-lg` (24). Os quatro `*-fill` (`ticket-fill`, `calendar-fill`, `qr-code-fill`,
`user-fill`) são próprios: exportar do Figma como SVG quando a primeira tela precisar.

## Ainda não implementados

| Figma                     | Nó do conjunto     | Variantes                                                                     |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Botão de ícone/Destrutivo | `42:258`           | Tamanho × Estado                                                              |
| Card                      | `51:358`           | Tipo × Estado × Espaço                                                        |
| Ingresso (restante)       | `56:409`           | Estado (Utilizado, Transferido, Cancelado)                                    |
| Aba · Barra de abas       | `73:39` · `73:376` | Estado · Abas × Selecionada                                                   |
| Stat Card                 | `114:184`          | Estado × Variação × Tamanho                                                   |
| Controle segmentado       | `154:520`          | Selecionada                                                                   |
| Cartão de evento          | `154:601`          | Tipo × Estado                                                                 |
| Resultado do leitor (UX)  | `119:447`          | Estado (Verificando, Válido, Já utilizado, Inválido, Cancelado, Outro evento) |

## Telas

Página "Compra" (`138:321`): página do evento, escolher ingresso, identificação (e-mail e código),
revisar pedido, Pix, pagamento confirmado, ingresso pronto, seus ingressos (e anteriores) e
ingresso, cada uma em 360 e 1440, mais os estados de borda (indisponível, valor mínimo, esgotou,
total mudou, pagamento não concluído, erro de conexão, vazio e entrar). Os IDs de cada quadro estão
na [SPEC-014](../06-sdd/SPEC-014-web-purchase.md) §5 e §6.
