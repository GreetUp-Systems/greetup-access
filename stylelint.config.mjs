/**
 * No loose values (docs/design/README.md): colors and dimensions come from the tokens generated
 * from Figma. tokens.css is generated and is the only place literal values live.
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
  },
};
