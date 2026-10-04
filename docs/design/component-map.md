# Mapa de componentes · Figma ↔ código

Leia antes de implementar qualquer tela. Cada linha liga um componente do
[Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) ao código em `@access/ui`.
Componente ainda não implementado é feito na primeira tela que precisar dele, e entra aqui.

## Implementados

### Button · `packages/ui/src/components/Button`

| Figma            | Nó        | Código                                |
| ---------------- | --------- | ------------------------------------- |
| Botão/Primário   | `29:120`  | `<Button variant="primary">` (padrão) |
| Botão/Secundário | `29:238`  | `<Button variant="secondary">`        |
| Botão/Fantasma   | `29:356`  | `<Button variant="ghost">`            |
| Botão/Destrutivo | `29:474`  | `<Button variant="destructive">`      |
| Botão/Inverso    | `130:312` | `<Button variant="inverse">`          |

| Propriedade no Figma                | Prop                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| Tamanho = S · M · L                 | `size="s" \| "m" \| "l"` (padrão `m`)                  |
| Rótulo                              | `children`                                             |
| Ícone esquerdo + troca              | `iconLeft` (ícone `lucide-react`)                      |
| Ícone direito + troca               | `iconRight`                                            |
| Estado = Carregando                 | `loading`                                              |
| Estado = Desabilitado               | `disabled`                                             |
| Estado = Hover · Foco · Pressionado | estados de CSS (`:hover`, `:focus-visible`, `:active`) |

Regras do Figma: no máximo um Primário por tela; Inverso substitui o Primário sobre imagem, câmera
ou vidro, nunca junto dele; Destrutivo sempre com confirmação.

Validado em 04/10/2026: catálogo em 1440 comparado com Primário, Secundário e Destrutivo no Figma.

## Ícones

Página "Ícones" (`27:2`): 47 ícones, dos quais 43 são Lucide com o mesmo nome (`Ícone/ticket` →
`Ticket` de `lucide-react`), traço 1,75, tamanhos `size/icon-sm` (16), `size/icon-md` (20) e
`size/icon-lg` (24). Os quatro `*-fill` (`ticket-fill`, `calendar-fill`, `qr-code-fill`,
`user-fill`) são próprios: exportar do Figma como SVG quando a primeira tela precisar.

## Ainda não implementados

| Figma                                                       | Nó do conjunto                        | Variantes                                                                     |
| ----------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Logo                                                        | `3:95`                                | Formato × Versão                                                              |
| Botão de ícone (Primário, Secundário, Fantasma, Destrutivo) | `42:63`, `42:124`, `42:197`, `42:258` | Tamanho × Estado                                                              |
| Botão de ícone/Vidro                                        | `91:176`                              | Forma × Estado                                                                |
| Campo de texto                                              | `44:232`                              | Tamanho × Estado                                                              |
| Status                                                      | `46:85`                               | 14 status × Tamanho                                                           |
| Card                                                        | `51:358`                              | Tipo × Estado × Espaço                                                        |
| Ingresso                                                    | `56:409`                              | Estado (Válido, Emitindo, Utilizado, Transferido, Cancelado)                  |
| Pix                                                         | `61:678`                              | Estado (Aguardando, Copiado, Expirado, Pago, Falhou)                          |
| Item de lista                                               | `66:322`                              | Estado × Densidade                                                            |
| Barra superior                                              | `70:318`                              | Tipo × Rolagem                                                                |
| Aba · Barra de abas                                         | `73:39` · `73:376`                    | Estado · Abas × Selecionada                                                   |
| Toast                                                       | `77:527`                              | Tom                                                                           |
| Stat Card                                                   | `114:184`                             | Estado × Variação × Tamanho                                                   |
| Controle segmentado                                         | `154:520`                             | Selecionada                                                                   |
| Cartão de evento                                            | `154:601`                             | Tipo × Estado                                                                 |
| Resultado do leitor (UX)                                    | `119:447`                             | Estado (Verificando, Válido, Já utilizado, Inválido, Cancelado, Outro evento) |

## Telas

Página "Compra" (`138:321`): página do evento, escolher ingresso, identificação (e-mail e código),
revisar pedido, Pix, pagamento confirmado, ingresso pronto, seus ingressos (e anteriores) e
ingresso, cada uma em 360 e 1440, mais os estados de borda (indisponível, valor mínimo, esgotou,
total mudou, pagamento não concluído, erro de conexão, vazio e entrar). Os IDs de cada quadro estão
na [SPEC-014](../06-sdd/SPEC-014-web-purchase.md) §5 e §6.
