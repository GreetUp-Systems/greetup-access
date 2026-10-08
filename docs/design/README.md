# Design no repositório

Como o Figma e o código trabalham juntos no Access. O resumo obrigatório está no `CLAUDE.md`
(seção "Frontend e design"); aqui ficam os detalhes.

## Fontes

| O quê                                          | Onde                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Design System, componentes e telas             | [Figma · Access — Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) (`WYqT9b0lxW4QhWmjuoPblV`) |
| Fluxos, regras por etapa e perguntas em aberto | [FigJam · Access · Fluxos de UX](https://www.figma.com/board/2lbuNUP0m7qulZGR9cVALm) (`2lbuNUP0m7qulZGR9cVALm`)  |
| Elo entre nó do Figma e código                 | [`component-map.md`](./component-map.md)                                                                         |
| Tokens (tema do Tailwind)                      | `packages/ui/tokens/figma-tokens.json` → `packages/ui/src/styles/tokens.css`                                     |
| Componentes (shadcn/ui adaptado)               | `packages/ui/src/components/`                                                                                    |
| App                                            | `apps/web` (Next.js 15)                                                                                          |

O Figma é fonte viva: o design evolui em paralelo ao código. Antes de implementar, releia o nó;
uma leitura antiga não vale. As decisões de UX são tomadas aqui, junto com as SPECs, e o resultado
sempre termina no Figma.

## Estrutura do arquivo do Figma

- **Fundações:** Logo, Cor, Tipografia, Espaço e forma, Efeitos.
- **Componentes:** uma página por componente (Botão, Campo de texto, Status, Card, Ingresso, Pix…).
- **UX:** padrões compostos (Resultado do leitor).
- **Telas:** uma página por fluxo (Compra), com cada tela em 360 (celular) e 1440 (desktop).
- **Variáveis:** `Primitives`, `Color` (modos Dark e Light), `Dimension` e `Contexto · Ícone`. Toda
  variável tem sintaxe de código web (`var(--color-bg-accent)`), e esse é o nome no CSS.
- **Estilos:** 24 de texto e 5 de efeito (inclusive `Glass/Superfície` e `Focus/Ring`).

## Regras

1. **Nenhum valor solto.** Cor, espaço, raio, tamanho, tipografia e efeito vêm de `tokens.css`, que é
   o tema inteiro do Tailwind: as escalas padrão do Tailwind são zeradas, então `p-3.5`,
   `bg-red-500` ou `text-sm` não existem. O ESLint barra classe fora do tema, valor arbitrário
   (`p-[13px]`) e cor literal; o stylelint barra hex, `rgb()`/`hsl()` e unidades nos CSS.
2. **Faltou no Figma, resolve no Figma.** Se a tela, o estado, o componente ou o token não existe,
   avise o Matheus ou crie no Figma seguindo o padrão do arquivo (nomes, coleção, escopo, sintaxe de
   código). Nunca invente no código. Exemplo: os tamanhos de ícone viraram `size/icon-sm|md|lg`.
3. **Design contra SPEC ou regra de negócio: pare e pergunte.**
4. **Nomes:** componentes em inglês no código, o mapa liga ao nome em português do Figma. Variantes
   viram props tipadas; Hover, Foco e Pressionado são estados de CSS; Desabilitado e Carregando são
   props.
5. **Textos** vêm do design (ou da SPEC de front, quando ela os define).

## Tailwind e tokens

O gerador transforma cada variável do Figma em tema do Tailwind, pelo nome da sintaxe de código:

| Figma                              | Variável CSS                        | Classe                                        |
| ---------------------------------- | ----------------------------------- | --------------------------------------------- |
| `bg/canvas`, `text/primary`…       | `--color-bg-canvas`                 | `bg-bg-canvas`, `text-text-primary`           |
| `space/4`                          | `--space-4` → `--spacing-4`         | `p-4`, `gap-4`                                |
| `size/control-md`, `size/icon-md`… | `--size-control-md` → `--spacing-…` | `h-control-md`, `size-icon-md`, `w-dialog`    |
| `radius/md`                        | `--radius-md`                       | `rounded-md`                                  |
| Estilo de texto `Body/M`           | utilitário                          | `type-body-m` (fonte, tamanho, altura, letra) |
| Efeito `Elevation/2`, `Glass/…`    | `--shadow-elevation-2`, `--blur-…`  | `shadow-elevation-2`, `backdrop-blur-…`       |
| `stroke/*`                         | `--stroke-focus`                    | `border` (1), `outline-2`, `w-(--stroke-…)`   |

Dark é o padrão; Light entra por `data-theme="light"` ou pela preferência do sistema (no MVP o app
força Dark). Um único breakpoint, `md:` (768), separa celular e desktop. `cn()` vem de
`@access/ui/lib/utils` e conhece essas escalas: `cn("h-control-md", "h-control-lg")` fica com a
última.

## Componentes com shadcn/ui

A base dos componentes é o shadcn/ui (primitivos Radix, estilo `radix-nova`), instalado em
`packages/ui` e adaptado ao Design System. Nunca escreva do zero um componente que o shadcn resolve.

1. Procure o equivalente no shadcn e adicione a partir de `packages/ui`:
   `pnpm dlx shadcn@latest add <componente>`.
2. Troque o import `from "cn"` que o CLI escreve por `from "@access/ui/lib/utils"` e remova a
   dependência `cn` que ele instala (`pnpm --filter @access/ui remove cn`). O ESLint barra o import.
3. Adapte ao Figma: variantes e tamanhos com os nomes do componente no Figma (`cva`), classes só do
   tema (`bg-bg-accent`, `h-control-md`, `type-ui-button-m`). O vocabulário do shadcn
   (`bg-primary`, `text-sm`, `h-9`, `dark:`) não existe no tema e o ESLint aponta o que sobrar.
4. Hover, pressionado e foco são `hover:`, `active:` e `focus-visible:`; no catálogo, essas variantes
   também respondem a `data-preview-state`.
5. Entre no mapa e no catálogo, e faça a conferência visual.

Composições sem equivalente no shadcn (Barra superior, Logo) são montadas sobre os primitivos dele.

## Atualizar os tokens

1. Rode `packages/ui/tokens/export-figma-tokens.js` com a ferramenta `use_figma` do MCP do Figma
   (somente leitura) no arquivo `WYqT9b0lxW4QhWmjuoPblV`, duas vezes: com `part = "variables"` e
   com `part = "styles"`. O conjunto passou do limite de 20 KB que a ferramenta devolve. A API REST
   de variáveis não existe no plano Pro; a execução de plugin é o caminho.
2. Junte as duas respostas num objeto `{ file, collections, textStyles, effectStyles }`, grave em
   uma linha em `packages/ui/tokens/figma-tokens.json` e formate com o Prettier, que mantém o estilo
   do arquivo.
3. `pnpm --filter @access/ui tokens` gera `tokens.css` e `src/lib/merge-theme.ts` (as escalas para o
   `cn()`). O lint falha se algum dos dois ficar defasado.
4. O diff do JSON e do CSS entra no PR.

## Conferência visual

1. Suba o app: `pnpm --filter @access/web dev`.
2. Capture em 360 e 1440: `pnpm --filter @access/web capture dev/catalog catalog` (rota sem a barra
   inicial). As imagens vão para `apps/web/.captures/`, fora do git. Na primeira vez:
   `pnpm --filter @access/web exec playwright install chromium`.
3. Capture o nó correspondente no Figma (`get_screenshot`) e compare lado a lado.
4. Corrija o que divergir e registre no PR o que foi comparado (nós do Figma, larguras, resultado).
   As imagens ficam em `.captures/`, fora do git.

`/dev/catalog` é o catálogo de componentes, só em desenvolvimento: renderiza cada componente na
mesma grade da página do Figma. Os estados de interação aparecem por `data-preview-state`, que existe
só para o catálogo.

## Uso do Figma pelo MCP

- O plano é Pro com limite de chamadas: leia por nó ou tela, nunca o arquivo inteiro.
- `get_metadata` sem nó lista só a primeira página carregada. Para a estrutura real, use um script
  de leitura com `use_figma`.
- `get_design_context` traz código React + Tailwind de referência: adapte ao projeto (componentes
  do `@access/ui` e classes do tema); nunca copie.
- `search_design_system` não encontra nada: a biblioteca não está publicada.
