# Design no repositório

Como o Figma e o código trabalham juntos no Access. O resumo obrigatório está no `CLAUDE.md`
(seção "Frontend e design"); aqui ficam os detalhes.

## Fontes

| O quê                                          | Onde                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Design System, componentes e telas             | [Figma · Access — Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) (`WYqT9b0lxW4QhWmjuoPblV`) |
| Fluxos, regras por etapa e perguntas em aberto | [FigJam · Access · Fluxos de UX](https://www.figma.com/board/2lbuNUP0m7qulZGR9cVALm) (`2lbuNUP0m7qulZGR9cVALm`)  |
| Elo entre nó do Figma e código                 | [`component-map.md`](./component-map.md)                                                                         |
| Tokens                                         | `packages/ui/tokens/figma-tokens.json` → `packages/ui/src/styles/tokens.css`                                     |
| Componentes                                    | `packages/ui/src/components/`                                                                                    |
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

1. **Nenhum valor solto.** Cor, espaço, raio, tamanho, tipografia e efeito vêm de `tokens.css`. O
   stylelint bloqueia hex, `rgb()`/`hsl()` e `px`/`rem`/`em` fora do arquivo gerado (exceto em media
   query); o ESLint bloqueia cor literal em `.ts`/`.tsx`.
2. **Faltou no Figma, resolve no Figma.** Se a tela, o estado, o componente ou o token não existe,
   avise o Matheus ou crie no Figma seguindo o padrão do arquivo (nomes, coleção, escopo, sintaxe de
   código). Nunca invente no código. Exemplo: os tamanhos de ícone viraram `size/icon-sm|md|lg`.
3. **Design contra SPEC ou regra de negócio: pare e pergunte.**
4. **Nomes:** componentes em inglês no código, o mapa liga ao nome em português do Figma. Variantes
   viram props tipadas; Hover, Foco e Pressionado são estados de CSS; Desabilitado e Carregando são
   props.
5. **Textos** vêm do design (ou da SPEC de front, quando ela os define).

## Atualizar os tokens

1. Rode `packages/ui/tokens/export-figma-tokens.js` com a ferramenta `use_figma` do MCP do Figma
   (somente leitura) no arquivo `WYqT9b0lxW4QhWmjuoPblV`. A API REST de variáveis não existe no plano
   Pro; a execução de plugin é o caminho.
2. Salve o JSON devolvido em `packages/ui/tokens/figma-tokens.json`.
3. `pnpm --filter @access/ui tokens` gera `tokens.css`. O lint falha se o CSS ficar defasado.
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
- `get_design_context` traz código React + Tailwind de referência: adapte ao projeto (CSS Modules e
  tokens); nunca copie.
- `search_design_system` não encontra nada: a biblioteca não está publicada.
