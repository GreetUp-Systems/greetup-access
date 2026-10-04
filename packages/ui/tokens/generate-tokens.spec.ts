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

describe("generateTokensCss", () => {
  it("keeps the Figma code syntax names and resolves aliases to CSS variables", () => {
    const css = generateTokensCss(minimal());

    expect(css).toContain("--palette-brand-midnight: #140b12;");
    expect(css).toMatch(
      /:root,\n\[data-theme="dark"\] \{\n {2}color-scheme: dark;\n {2}--color-bg-canvas: var\(--palette-brand-midnight\);/,
    );
    expect(css).toMatch(
      /\[data-theme="light"\] \{\n {2}color-scheme: light;\n {2}--color-bg-canvas: var\(--palette-brand-creme\);/,
    );
    expect(css).toContain("@media (prefers-color-scheme: light) {\n  :root:not([data-theme]) {");
  });

  it("maps text styles to a font shorthand, tracking in em and text case", () => {
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

    expect(css).toContain("--text-label-m: 500 12px/16px var(--font-mono);");
    expect(css).toContain("--text-label-m-tracking: 0.14em;");
    expect(css).toContain("--text-label-m-case: uppercase;");
    expect(css).toContain("--text-tab-rotulo: 600 10px/12px var(--font-sans);");
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

    expect(css).toContain(
      "--effect-focus-ring: 0 0 0 2px var(--color-bg-canvas), 0 0 0 4px #d24fc6;",
    );
    expect(css).toContain("--effect-glass-superficie-blur: blur(15px);");
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
    expect(css).toContain("--color-bg-accent: var(--palette-brand-magenta);");
    expect(css).toContain("--size-control-md: 44px;");
    expect(css).toContain("--text-ui-button-m: 600 14px/20px var(--font-sans);");
    expect(slug("Body/L Strong")).toBe("body-l-strong");
  });
});
