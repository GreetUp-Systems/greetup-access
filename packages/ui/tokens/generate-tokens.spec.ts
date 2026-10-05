import { readFileSync } from "node:fs";
import { join } from "node:path";

import { generateTokensCss, slug, type TokenSnapshot, TokenSnapshotError } from "./generate-tokens";

const snapshot = JSON.parse(
  readFileSync(join(__dirname, "figma-tokens.json"), "utf8"),
) as TokenSnapshot;

function minimal(overrides: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    file: "test",
    collections: [
      {
        name: "Primitives",
        modes: ["Value"],
        variables: [
          {
            name: "brand/midnight",
            type: "COLOR",
            web: "var(--palette-brand-midnight)",
            values: { Value: "#140b12" },
          },
          {
            name: "brand/creme",
            type: "COLOR",
            web: "var(--palette-brand-creme)",
            values: { Value: "#fbf7ef" },
          },
        ],
      },
      {
        name: "Color",
        modes: ["Dark", "Light"],
        variables: [
          {
            name: "bg/canvas",
            type: "COLOR",
            web: "var(--color-bg-canvas)",
            values: { Dark: { alias: "brand/midnight" }, Light: { alias: "brand/creme" } },
          },
        ],
      },
    ],
    textStyles: [],
    effectStyles: [],
    ...overrides,
  };
}

function themeBlock(css: string): string {
  const match = /@theme static \{\n([\s\S]*?)\n\}/.exec(css);
  if (match === null) {
    throw new Error("No @theme block.");
  }
  return match[1]!;
}

describe("generateTokensCss", () => {
  it("keeps the Figma code syntax names and puts the Dark colors in the Tailwind theme", () => {
    const css = generateTokensCss(minimal());

    expect(css).toContain(":root {\n  --palette-brand-midnight: #140b12;");
    expect(themeBlock(css)).toContain("  --color-bg-canvas: var(--palette-brand-midnight);");
    expect(css).toContain(
      '[data-theme="dark"] {\n  --color-bg-canvas: var(--palette-brand-midnight);',
    );
    expect(css).toContain(
      '[data-theme="light"] {\n  color-scheme: light;\n  --color-bg-canvas: var(--palette-brand-creme);',
    );
    expect(css).toContain("@media (prefers-color-scheme: light) {\n  :root:not([data-theme]) {");
  });

  it("drops Tailwind's default scales so only design system values have utilities", () => {
    const theme = themeBlock(generateTokensCss(minimal()));

    for (const namespace of ["--color-*", "--spacing", "--spacing-*", "--text-*", "--radius-*"]) {
      expect(theme).toContain(`  ${namespace}: initial;`);
    }
  });

  it("feeds space and size variables to the spacing scale and keeps radius in the theme", () => {
    const css = generateTokensCss(
      minimal({
        collections: [
          {
            name: "Dimension",
            modes: ["Value"],
            variables: [
              { name: "space/4", type: "FLOAT", web: "var(--space-4)", values: { Value: 16 } },
              {
                name: "size/control-md",
                type: "FLOAT",
                web: "var(--size-control-md)",
                values: { Value: 44 },
              },
              { name: "radius/md", type: "FLOAT", web: "var(--radius-md)", values: { Value: 12 } },
              {
                name: "stroke/focus",
                type: "FLOAT",
                web: "var(--stroke-focus)",
                values: { Value: 2 },
              },
            ],
          },
        ],
      }),
    );
    const theme = themeBlock(css);

    expect(css).toContain("  --space-4: 16px;");
    expect(theme).toContain("  --spacing-4: var(--space-4);");
    expect(theme).toContain("  --spacing-control-md: var(--size-control-md);");
    expect(theme).toContain("  --radius-md: 12px;");
    expect(css).toContain("  --stroke-focus: 2px;");
    expect(theme).not.toContain("--stroke-focus");
  });

  it("turns each text style into a type-* utility with tracking in em and text case", () => {
    const css = generateTokensCss(
      minimal({
        textStyles: [
          {
            name: "Label/M",
            family: "JetBrains Mono",
            style: "Medium",
            size: 12,
            lineHeight: 16,
            letterSpacingPercent: 14,
            textCase: "UPPER",
          },
          {
            name: "Tab/Rótulo",
            family: "Inter",
            style: "Semi Bold",
            size: 10,
            lineHeight: 12,
            letterSpacingPercent: 0,
            textCase: "ORIGINAL",
          },
        ],
      }),
    );

    expect(css).toContain(
      "@utility type-label-m {\n  font: 500 12px/16px var(--font-mono);\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}",
    );
    expect(css).toContain(
      "@utility type-tab-rotulo {\n  font: 600 10px/12px var(--font-sans);\n  letter-spacing: 0;\n}",
    );
  });

  it("orders shadows top first, binds colors to variables and halves the background blur", () => {
    const css = generateTokensCss(
      minimal({
        effectStyles: [
          {
            name: "Focus/Ring",
            effects: [
              {
                type: "DROP_SHADOW",
                radius: 0,
                spread: 4,
                offset: { x: 0, y: 0 },
                color: "#d24fc6",
                colorVariable: null,
              },
              {
                type: "DROP_SHADOW",
                radius: 0,
                spread: 2,
                offset: { x: 0, y: 0 },
                color: "#140b12",
                colorVariable: "bg/canvas",
              },
            ],
          },
          {
            name: "Glass/Superfície",
            effects: [
              {
                type: "BACKGROUND_BLUR",
                radius: 30,
                spread: null,
                offset: null,
                color: null,
                colorVariable: null,
              },
            ],
          },
        ],
      }),
    );
    const theme = themeBlock(css);

    expect(theme).toContain(
      "  --shadow-focus-ring: 0 0 0 2px var(--color-bg-canvas), 0 0 0 4px #d24fc6;",
    );
    expect(theme).toContain("  --blur-glass-superficie: 15px;");
  });

  it("refuses a variable without code syntax and an alias to an unknown variable", () => {
    const withoutWeb = minimal();
    withoutWeb.collections[0]!.variables[0]!.web = null;
    expect(() => generateTokensCss(withoutWeb)).toThrow(TokenSnapshotError);

    const brokenAlias = minimal();
    brokenAlias.collections[1]!.variables[0]!.values.Dark = { alias: "brand/missing" };
    expect(() => generateTokensCss(brokenAlias)).toThrow("brand/missing");
  });

  it("generates the committed snapshot without errors", () => {
    const css = generateTokensCss(snapshot);
    expect(themeBlock(css)).toContain("--color-bg-accent: var(--palette-brand-magenta);");
    expect(css).toContain("--size-control-md: 44px;");
    expect(css).toContain("@utility type-ui-button-m {\n  font: 600 14px/20px var(--font-sans);");
    expect(slug("Body/L Strong")).toBe("body-l-strong");
  });
});
