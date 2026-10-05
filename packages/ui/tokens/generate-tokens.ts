/**
 * Turns the Figma token snapshot (figma-tokens.json) into tokens.css, the Tailwind theme of the
 * design system. Variable names come from each variable's Figma code syntax, so the CSS matches
 * what the Figma MCP emits for a node; Tailwind utilities are built from the same variables:
 *
 * - `Color` (Dark and Light) is the `--color-*` theme: `bg-bg-canvas`, `text-text-primary`…
 *   Dark is the default; Light applies by system preference or by data-theme="light".
 * - `space/*` and `size/*` feed `--spacing-*`: `p-4` is space/4, `h-control-md` is size/control-md.
 * - `radius/*` is the `--radius-*` theme: `rounded-md`.
 * - Text styles are `type-*` utilities (`type-body-m`) and effect styles are `shadow-*` and
 *   `backdrop-blur-*` theme values.
 *
 * Tailwind's default scales are reset, so a value outside the design system has no utility.
 */

export type TokenValue = string | number | { alias: string };

export interface TokenVariable {
  name: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  web: string | null;
  values: Record<string, TokenValue>;
}

export interface TokenCollection {
  name: string;
  modes: string[];
  variables: TokenVariable[];
}

export interface TextStyleToken {
  name: string;
  family: string;
  style: string;
  size: number;
  lineHeight: number | null;
  letterSpacingPercent: number | null;
  textCase: string;
}

export interface EffectToken {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "BACKGROUND_BLUR" | "LAYER_BLUR";
  radius: number;
  spread: number | null;
  offset: { x: number; y: number } | null;
  color: string | null;
  colorVariable: string | null;
}

export interface TokenSnapshot {
  file: string;
  collections: TokenCollection[];
  textStyles: TextStyleToken[];
  effectStyles: Array<{ name: string; effects: EffectToken[] }>;
}

const darkMode = "Dark";
const lightMode = "Light";

const fontFamilies: Record<string, string> = {
  Unbounded: "var(--font-display)",
  Inter: "var(--font-sans)",
  "JetBrains Mono": "var(--font-mono)",
};

const fontWeights: Record<string, number> = {
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  "Semi Bold": 600,
  Bold: 700,
};

// Tailwind namespaces whose defaults are dropped: only the design system's values remain.
const resetNamespaces = [
  "--color-*",
  "--font-*",
  "--font-weight-*",
  "--text-*",
  "--tracking-*",
  "--leading-*",
  "--spacing",
  "--spacing-*",
  "--radius-*",
  "--shadow-*",
  "--inset-shadow-*",
  "--drop-shadow-*",
  "--text-shadow-*",
  "--blur-*",
];

export class TokenSnapshotError extends Error {}

export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cssName(variable: TokenVariable): string {
  const match = /^var\((--[a-z0-9-]+)\)$/.exec(variable.web ?? "");
  if (match === null) {
    throw new TokenSnapshotError(`Variable ${variable.name} has no web code syntax.`);
  }
  return match[1]!;
}

function px(value: number): string {
  return value === 0 ? "0" : `${value}px`;
}

export function generateTokensCss(snapshot: TokenSnapshot): string {
  const names = new Map<string, string>();
  for (const collection of snapshot.collections) {
    for (const variable of collection.variables) {
      if (names.has(variable.name)) {
        throw new TokenSnapshotError(`Variable ${variable.name} is defined twice.`);
      }
      names.set(variable.name, cssName(variable));
    }
  }

  const reference = (name: string): string => {
    const target = names.get(name);
    if (target === undefined) {
      throw new TokenSnapshotError(`Alias to unknown variable ${name}.`);
    }
    return `var(${target})`;
  };

  const literal = (variable: TokenVariable, value: TokenValue | undefined): string => {
    if (value === undefined) {
      throw new TokenSnapshotError(`Variable ${variable.name} has no value for a mode.`);
    }
    if (typeof value === "object") {
      return reference(value.alias);
    }
    if (typeof value === "number") {
      return variable.type === "FLOAT" ? px(value) : String(value);
    }
    return value;
  };

  const declaration = (variable: TokenVariable, mode: string): string =>
    `  ${cssName(variable)}: ${literal(variable, variable.values[mode])};`;

  const raw: string[] = [];
  const theme: string[] = [
    ...resetNamespaces.map((namespace) => `  ${namespace}: initial;`),
    '  --font-display: var(--font-unbounded, "Unbounded"), system-ui, sans-serif;',
    '  --font-sans: var(--font-inter, "Inter"), system-ui, sans-serif;',
    '  --font-mono: var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, monospace;',
  ];
  const spacing: string[] = [];
  let darkBlock: string[] = [];
  let lightBlock: string[] = [];

  for (const collection of snapshot.collections) {
    if (collection.modes.includes(darkMode) && collection.modes.includes(lightMode)) {
      darkBlock = collection.variables.map((variable) => declaration(variable, darkMode));
      lightBlock = collection.variables.map((variable) => declaration(variable, lightMode));
      theme.push(...darkBlock);
      continue;
    }
    // Single-mode collections, and contextual ones such as the icon context, use their first
    // mode; in code an icon takes the color of its context through currentColor.
    const mode = collection.modes[0]!;
    for (const variable of collection.variables) {
      const name = cssName(variable);
      if (name.startsWith("--radius-")) {
        theme.push(declaration(variable, mode));
        continue;
      }
      raw.push(declaration(variable, mode));
      if (name.startsWith("--space-")) {
        spacing.push(`  --spacing-${name.slice("--space-".length)}: var(${name});`);
      } else if (name.startsWith("--size-")) {
        spacing.push(`  --spacing-${name.slice("--size-".length)}: var(${name});`);
      }
    }
  }
  theme.push(...spacing);

  const utilities: string[] = [];
  for (const style of snapshot.textStyles) {
    const family = fontFamilies[style.family];
    const weight = fontWeights[style.style];
    if (family === undefined || weight === undefined || style.lineHeight === null) {
      throw new TokenSnapshotError(
        `Text style ${style.name} uses an unmapped font or line height.`,
      );
    }
    const tracking = style.letterSpacingPercent ?? 0;
    utilities.push(
      `@utility type-${slug(style.name)} {`,
      `  font: ${weight} ${px(style.size)}/${px(style.lineHeight)} ${family};`,
      `  letter-spacing: ${tracking === 0 ? "0" : `${tracking / 100}em`};`,
      ...(style.textCase === "UPPER" ? ["  text-transform: uppercase;"] : []),
      "}",
      "",
    );
  }

  for (const style of snapshot.effectStyles) {
    const name = slug(style.name);
    const shadows: string[] = [];
    for (const effect of style.effects) {
      if (effect.type === "BACKGROUND_BLUR") {
        // Figma's blur radius is twice the CSS blur() radius.
        theme.push(`  --blur-${name}: ${px(effect.radius / 2)};`);
        continue;
      }
      if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
        throw new TokenSnapshotError(`Effect ${style.name} uses unsupported ${effect.type}.`);
      }
      const color = effect.colorVariable === null ? effect.color : reference(effect.colorVariable);
      const offset = effect.offset ?? { x: 0, y: 0 };
      shadows.push(
        `${effect.type === "INNER_SHADOW" ? "inset " : ""}${px(offset.x)} ${px(offset.y)} ${px(effect.radius)} ${px(effect.spread ?? 0)} ${color}`,
      );
    }
    if (shadows.length > 0) {
      // Figma lists effects bottom to top; CSS paints the first shadow on top.
      theme.push(`  --shadow-${name}: ${shadows.reverse().join(", ")};`);
    }
  }

  return [
    `/* Generated from tokens/figma-tokens.json (Figma file ${snapshot.file}). Do not edit: run`,
    "   `pnpm --filter @access/ui tokens` after exporting a new snapshot. */",
    "",
    "/* Figma variables that are not utilities by themselves: palette, sizes, strokes, contexts. */",
    ":root {",
    ...raw,
    "}",
    "",
    "/* The Tailwind theme: Dark colors by default, spacing, radius, fonts and effects. */",
    "@theme static {",
    ...theme,
    "}",
    "",
    ":root,",
    '[data-theme="dark"] {',
    "  color-scheme: dark;",
    "}",
    "",
    '[data-theme="dark"] {',
    ...darkBlock,
    "}",
    "",
    '[data-theme="light"] {',
    "  color-scheme: light;",
    ...lightBlock,
    "}",
    "",
    "@media (prefers-color-scheme: light) {",
    "  :root:not([data-theme]) {",
    "    color-scheme: light;",
    ...lightBlock.map((line) => `  ${line}`),
    "  }",
    "}",
    "",
    "/* Figma text styles, one utility each. */",
    ...utilities,
  ].join("\n");
}

/**
 * The theme keys tailwind-merge needs to resolve conflicts between design system classes
 * (`h-control-md` vs `h-control-lg`, `type-body-m` vs `type-body-l`) in `cn()`.
 */
export function generateMergeTheme(snapshot: TokenSnapshot): string {
  const spacing: string[] = [];
  const radius: string[] = [];
  for (const collection of snapshot.collections) {
    if (collection.modes.length !== 1) {
      continue;
    }
    for (const variable of collection.variables) {
      const name = cssName(variable);
      for (const [prefix, list] of [
        ["--space-", spacing],
        ["--size-", spacing],
        ["--radius-", radius],
      ] as const) {
        if (name.startsWith(prefix)) {
          list.push(name.slice(prefix.length));
        }
      }
    }
  }
  const shadow: string[] = [];
  const blur: string[] = [];
  for (const style of snapshot.effectStyles) {
    for (const effect of style.effects) {
      const list = effect.type === "BACKGROUND_BLUR" ? blur : shadow;
      if (!list.includes(slug(style.name))) {
        list.push(slug(style.name));
      }
    }
  }
  const typography = snapshot.textStyles.map((style) => slug(style.name));
  const constant = (name: string, values: string[]): string =>
    `export const ${name} = [${values.map((value) => `"${value}"`).join(", ")}];`;

  return [
    `// Generated from tokens/figma-tokens.json (Figma file ${snapshot.file}). Do not edit: run`,
    "// `pnpm --filter @access/ui tokens` after exporting a new snapshot.",
    "",
    constant("spacing", spacing),
    constant("radius", radius),
    constant("shadow", shadow),
    constant("blur", blur),
    constant("typography", typography),
    "",
  ].join("\n");
}
