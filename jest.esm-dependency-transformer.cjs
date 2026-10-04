const ts = require("typescript");

module.exports = {
  process(sourceText, sourcePath) {
    const output = ts.transpileModule(sourceText, {
      compilerOptions: {
        allowJs: true,
        module: ts.ModuleKind.CommonJS,
        sourceMap: true,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: sourcePath,
    });

    return { code: output.outputText };
  },
};
