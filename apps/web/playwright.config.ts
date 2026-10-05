import { defineConfig, devices } from "@playwright/test";

// End-to-end tests with the API simulated (SPEC-014 §11): e2e/mock-api.mjs answers both the
// server-rendered pages and the browser. Ports 3100/3101 leave the dev servers (3000/3001) alone.
const webPort = 3100;
const apiPort = 3101;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "retain-on-failure",
  },
  // The two widths the Figma screens are drawn at.
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `node e2e/mock-api.mjs`,
      port: apiPort,
      env: { MOCK_API_PORT: String(apiPort) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `next build && next start --port ${webPort}`,
      port: webPort,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api`,
        // Privy only checks the length (25); the tests never sign in.
        NEXT_PUBLIC_PRIVY_APP_ID: "e2e0privy0app0id000000000",
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
