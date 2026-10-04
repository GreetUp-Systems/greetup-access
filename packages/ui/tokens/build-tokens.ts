import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateTokensCss, type TokenSnapshot } from "./generate-tokens";

// `tsx tokens/build-tokens.ts` writes tokens.css; `--check` fails when it is stale (lint and CI).
const root = join(__dirname, "..");
const snapshotPath = join(root, "tokens", "figma-tokens.json");
const outputPath = join(root, "src", "styles", "tokens.css");

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as TokenSnapshot;
const css = generateTokensCss(snapshot);

if (process.argv.includes("--check")) {
  let current: string;
  try {
    current = readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n");
  } catch {
    current = "";
  }
  if (current !== css) {
    process.stderr.write("tokens.css is out of date: run `pnpm --filter @access/ui tokens`.\n");
    process.exitCode = 1;
  }
} else {
  writeFileSync(outputPath, css);
  process.stdout.write(`Wrote ${outputPath}\n`);
}
