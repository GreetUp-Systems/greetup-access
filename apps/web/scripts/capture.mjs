// Captures pages at the two widths the Figma screens are drawn at (360 and 1440), for the visual
// comparison with Figma. Usage: pnpm --filter @access/web capture dev/catalog [name]
// Needs the app running (pnpm --filter @access/web dev) and `pnpm exec playwright install chromium`.
// Signed-in pages run against the end-to-end setup (the simulated API and NEXT_PUBLIC_E2E_SESSION):
// CAPTURE_BASE_URL points at it, CAPTURE_SESSION is the test session ("1" or a producer scenario,
// app/_lib/e2e-session.ts) and CAPTURE_SCHEME=light captures the light mode.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "playwright";

// The route is given without the leading slash (dev/catalog): Git Bash on Windows rewrites "/dev".
const route = (process.argv[2] ?? "dev/catalog").replace(/^\/+/, "");
const path = `/${route}`;
const name = process.argv[3] ?? (path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home");
const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const session = process.env.CAPTURE_SESSION;
const colorScheme = process.env.CAPTURE_SCHEME === "light" ? "light" : "dark";
const outputDir = join(import.meta.dirname, "..", ".captures");
const widths = [360, 1440];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      colorScheme,
    });
    if (session !== undefined) {
      await page.addInitScript((value) => {
        globalThis.localStorage.setItem("access-e2e-session", value);
      }, session);
    }
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    // Runs in the page: wait for the web fonts so the capture matches the Figma typography.
    await page.evaluate(() => globalThis.document.fonts.ready);
    const file = join(outputDir, `${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
    process.stdout.write(`${file}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}
