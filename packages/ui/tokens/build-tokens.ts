import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateMergeTheme, generateTokensCss, type TokenSnapshot } from "./generate-tokens";

// `tsx tokens/build-tokens.ts` writes tokens.css and the tailwind-merge theme; `--check` fails
// when either is stale (lint and CI).
const root = join(__dirname, "..");
const snapshot = JSON.parse(
  readFileSync(join(root, "tokens", "figma-tokens.json"), "utf8"),
) as TokenSnapshot;
const outputs = [
  { path: join(root, "src", "styles", "tokens.css"), content: generateTokensCss(snapshot) },
  { path: join(root, "src", "lib", "merge-theme.ts"), content: generateMergeTheme(snapshot) },
];

for (const { path, content } of outputs) {
  if (process.argv.includes("--check")) {
    let current: string;
    try {
      current = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    } catch {
      current = "";
    }
    if (current !== content) {
      process.stderr.write(`${path} is out of date: run \`pnpm --filter @access/ui tokens\`.\n`);
      process.exitCode = 1;
    }
  } else {
    writeFileSync(path, content);
    process.stdout.write(`Wrote ${path}\n`);
  }
}
