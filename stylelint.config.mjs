/**
 * No loose values (docs/design/README.md): colors and dimensions come from the tokens generated
 * from Figma. tokens.css is generated and is the only place literal values live. Styling is
 * Tailwind; CSS files are only the design system's entry (globals.css) and the generated theme.
 */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["**/node_modules/**", "**/.next/**", "packages/ui/src/styles/tokens.css"],
  rules: {
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": [
      "rgb",
      "rgba",
      "hsl",
      "hsla",
      "hwb",
      "lab",
      "lch",
      "oklab",
      "oklch",
    ],
    "unit-disallowed-list": [
      ["px", "rem", "em", "pt"],
      { ignoreMediaFeatureNames: { px: ["min-width", "max-width", "width"] } },
    ],
    // CSS Modules: class names are read from TypeScript as camelCase properties.
    "selector-class-pattern": null,
    "import-notation": "string",
    // State selectors (:hover, :active, [data-preview-state]) read better grouped by state.
    "no-descending-specificity": null,
    "keyframes-name-pattern": null,
    // Tailwind v4 directives (packages/ui/src/styles/globals.css and tokens.css).
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme", "utility", "custom-variant", "variant", "source", "apply", "slot"],
      },
    ],
    "at-rule-prelude-no-invalid": [true, { ignoreAtRules: ["apply"] }],
    // Theme namespaces are reset with a trailing * (--color-*: initial).
    "custom-property-pattern": ["^[a-z][a-z0-9]*(-[a-z0-9]+)*(-\\*)?$"],
    // @custom-variant blocks use & for the element the variant applies to.
    "nesting-selector-no-missing-scoping-root": null,
  },
};
