// Read-only Figma plugin script that exports the design tokens of the Access design system.
// Run it with the Figma MCP `use_figma` tool on file WYqT9b0lxW4QhWmjuoPblV and save the
// returned JSON as packages/ui/tokens/figma-tokens.json; then run `pnpm --filter @access/ui
// tokens`. It never writes to the Figma file.

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();
const byId = Object.fromEntries(variables.map((variable) => [variable.id, variable]));

// Colors as #rrggbb or #rrggbbaa keep the snapshot compact (tool output is capped) and readable.
const hexByte = (component) =>
  Math.round(component * 255)
    .toString(16)
    .padStart(2, "0");

function value(raw) {
  if (raw && typeof raw === "object" && raw.type === "VARIABLE_ALIAS") {
    return { alias: byId[raw.id] ? byId[raw.id].name : raw.id };
  }
  if (raw && typeof raw === "object" && "r" in raw) {
    const opaque = raw.a === undefined || raw.a >= 1;
    return `#${hexByte(raw.r)}${hexByte(raw.g)}${hexByte(raw.b)}${opaque ? "" : hexByte(raw.a)}`;
  }
  return raw;
}

const textStyles = await figma.getLocalTextStylesAsync();
const effectStyles = await figma.getLocalEffectStylesAsync();

return {
  file: "WYqT9b0lxW4QhWmjuoPblV",
  collections: collections.map((collection) => ({
    name: collection.name,
    modes: collection.modes.map((mode) => mode.name),
    variables: collection.variableIds.map((id) => {
      const variable = byId[id];
      return {
        name: variable.name,
        type: variable.resolvedType,
        web: variable.codeSyntax.WEB || null,
        values: Object.fromEntries(
          collection.modes.map((mode) => [mode.name, value(variable.valuesByMode[mode.modeId])]),
        ),
      };
    }),
  })),
  textStyles: textStyles.map((style) => ({
    name: style.name,
    family: style.fontName.family,
    style: style.fontName.style,
    size: style.fontSize,
    lineHeight: style.lineHeight.unit === "PIXELS" ? style.lineHeight.value : null,
    letterSpacingPercent:
      style.letterSpacing.unit === "PERCENT"
        ? Math.round(style.letterSpacing.value * 100) / 100
        : null,
    textCase: style.textCase,
  })),
  effectStyles: effectStyles.map((style) => ({
    name: style.name,
    effects: style.effects
      .filter((effect) => effect.visible)
      .map((effect) => ({
        type: effect.type,
        radius: effect.radius,
        spread: effect.spread === undefined ? null : effect.spread,
        offset: effect.offset || null,
        color: effect.color ? value(effect.color) : null,
        colorVariable:
          effect.boundVariables && effect.boundVariables.color
            ? byId[effect.boundVariables.color.id].name
            : null,
      })),
  })),
};
