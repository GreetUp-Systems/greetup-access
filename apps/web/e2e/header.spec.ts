import { expect, test } from "@playwright/test";

// The header's account action (SPEC-014 §5): an esqueleto holds its place while the session is
// unknown (Header · Sessão carregando, 231:5834). "Entrar" itself needs a ready Privy, which the
// placeholder app id of these tests never gets.

test("holds the account action's place while the session loads", async ({ page }) => {
  // Privy never answers, so the session stays unknown.
  await page.route(/privy\.io/, () => undefined);
  await page.goto("/e/festival-de-inverno");

  await expect(page.locator('[data-slot="skeleton"]').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
});
