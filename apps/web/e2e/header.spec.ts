import { expect, test } from "@playwright/test";

// The header's account (SPEC-016 §6): an esqueleto holds its place while the session is unknown
// (Header · Sessão carregando, 231:5834), on the desktop's Cabeçalho do site and on the phone's
// Barra superior. Without the test session, Privy's placeholder app id never gets ready.

test("holds the account action's place while the session loads", async ({ page }) => {
  // Privy never answers, so the session stays unknown.
  await page.route(/privy\.io/, () => undefined);
  await page.goto("/e/festival-de-inverno");

  await expect(page.locator('[data-slot="skeleton"]').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
});
