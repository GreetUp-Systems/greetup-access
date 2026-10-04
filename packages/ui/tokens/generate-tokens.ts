/**
 * Turns the Figma token snapshot (figma-tokens.json) into tokens.css. Variable names come from
 * each variable's Figma code syntax, so the CSS matches what the Figma MCP emits for a node.
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

// Color modes of the "Color" collection: Dark is the default and the fallback without a system
// preference; Light applies by system preference or by data-theme="light".
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

  const declarations = (collection: TokenCollection, mode: string): string[] =>
    collection.variables.map(
      (variable) => `  ${cssName(variable)}: ${literal(variable, variable.values[mode])};`,
    );

  const root: string[] = [
    '  --font-display: var(--font-unbounded, "Unbounded"), system-ui, sans-serif;',
    '  --font-sans: var(--font-inter, "Inter"), system-ui, sans-serif;',
    '  --font-mono: var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, monospace;',
  ];
  let darkBlock: string[] = [];
  let lightBlock: string[] = [];

  for (const collection of snapshot.collections) {
    if (collection.modes.includes(darkMode) && collection.modes.includes(lightMode)) {
      darkBlock = declarations(collection, darkMode);
      lightBlock = declarations(collection, lightMode);
    } else {
      // Single-mode collections, and contextual ones such as the icon context, use their first
      // mode; in code an icon takes the color of its context through currentColor.
      root.push(...declarations(collection, collection.modes[0]!));
    }
  }

  for (const style of snapshot.textStyles) {
    const family = fontFamilies[style.family];
    const weight = fontWeights[style.style];
    if (family === undefined || weight === undefined || style.lineHeight === null) {
      throw new TokenSnapshotError(
        `Text style ${style.name} uses an unmapped font or line height.`,
      );
    }
    const name = `--text-${slug(style.name)}`;
    root.push(`  ${name}: ${weight} ${px(style.size)}/${px(style.lineHeight)} ${family};`);
    const tracking = style.letterSpacingPercent ?? 0;
    root.push(`  ${name}-tracking: ${tracking === 0 ? "0" : `${tracking / 100}em`};`);
    root.push(`  ${name}-case: ${style.textCase === "UPPER" ? "uppercase" : "none"};`);
  }

  for (const style of snapshot.effectStyles) {
    const name = `--effect-${slug(style.name)}`;
    const shadows: string[] = [];
    for (const effect of style.effects) {
      if (effect.type === "BACKGROUND_BLUR") {
        // Figma's blur radius is twice the CSS blur() radius.
        root.push(`  ${name}-blur: blur(${px(effect.radius / 2)});`);
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
      root.push(`  ${name}: ${shadows.reverse().join(", ")};`);
    }
  }

  return [
    `/* Generated from tokens/figma-tokens.json (Figma file ${snapshot.file}). Do not edit: run`,
    "   `pnpm --filter @access/ui tokens` after exporting a new snapshot. */",
    "",
    ":root {",
    ...root,
    "}",
    "",
    ':root,\n[data-theme="dark"] {',
    "  color-scheme: dark;",
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
  ].join("\n");
}
