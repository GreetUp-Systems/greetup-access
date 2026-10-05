import { fileURLToPath } from "node:url";

import eslint from "@eslint/js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import globals from "globals";
import tseslint from "typescript-eslint";

// Absolute, because each package runs its own lint from its own directory.
const designSystemCss = fileURLToPath(
  new URL("./packages/ui/src/styles/globals.css", import.meta.url),
);

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/generated/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "packages/ui/tokens/export-figma-tokens.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Frontend: browser globals and no literal colors; values come from the Figma tokens.
    files: ["packages/ui/src/**/*.{ts,tsx}", "apps/web/app/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a design token (CSS variable from @access/ui) instead of a literal color.",
        },
      ],
      // Class merging goes through @access/ui/lib/utils, the one that knows the design system's
      // scales; the shadcn CLI writes `from "cn"` and that import is swapped after each add.
      "no-restricted-imports": [
        "error",
        ...["cn", "clsx", "tailwind-merge"].map((name) => ({
          name,
          message: "Import cn from @access/ui/lib/utils (it knows the design system scales).",
        })),
      ],
    },
  },
  {
    // The one place that builds cn() from clsx and tailwind-merge.
    files: ["packages/ui/src/lib/utils.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Tailwind classes come from the design system theme (packages/ui/src/styles/tokens.css,
    // generated from Figma): a class outside it does not exist, and arbitrary values are loose
    // values. Arbitrary variants such as [&_svg]: stay allowed.
    files: ["packages/ui/src/**/*.tsx", "apps/web/app/**/*.tsx"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": { entryPoint: designSystemCss },
    },
    rules: {
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "\\[([^\\[\\]]*?)\\](?!:)",
              message: "Arbitrary values are loose values: use a design system token.",
            },
          ],
        },
      ],
    },
  },
);
