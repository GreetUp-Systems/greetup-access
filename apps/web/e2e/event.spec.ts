import { expect, type Page, test } from "@playwright/test";

// The event page and the ticket choice (SPEC-014 9C.1), on the phone sheet and the desktop card.
// The phone bar and the desktop card both exist in the page; only one is visible per width.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

async function openChoice(page: Page): Promise<void> {
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Comprar ingresso" }).click();
  }
}

/** The chooser in view: the sheet on the phone, the side card on the desktop. */
function chooser(page: Page) {
  return isPhone(page)
    ? page.getByRole("dialog", { name: "Escolha seu ingresso" })
    : page.getByRole("complementary").getByRole("region", { name: "Comprar ingresso" });
}

test("shows the event and the cheapest available price", async ({ page }) => {
  await page.goto("/e/festival-de-inverno");

  await expect(page.getByRole("heading", { level: 1, name: "Festival de Inverno" })).toBeVisible();
  await expect(page.getByText("Organizado por Casa Fluida")).toBeVisible();
  await expect(page.getByText("A partir de").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("R$ 60,00").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Política de reembolso" })).toBeVisible();
  await expect(page).toHaveTitle("Festival de Inverno · Access");
});

test("chooses a ticket type and a quantity up to what is available", async ({ page }) => {
  await page.goto("/e/festival-de-inverno");
  await openChoice(page);
  const panel = chooser(page);

  // A sold-out type cannot be chosen.
  await expect(panel.getByRole("radio", { name: /Meia-entrada/ })).toBeDisabled();
  await expect(panel.getByText("Esgotado")).toBeVisible();

  await panel.getByRole("radio", { name: /Camarote/ }).click();
  await expect(panel.getByRole("radio", { name: /Camarote/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  const more = panel.getByRole("button", { name: "Aumentar a quantidade" });
  await more.click();
  await expect(panel.getByText("R$ 240,00")).toBeVisible();
  // Only 2 Camarote tickets are left.
  await expect(more).toBeDisabled();
});

test("a cancelled event shows the closed sales and no purchase", async ({ page }) => {
  await page.goto("/e/festival-cancelado");

  await expect(page.getByText("Cancelado").filter({ visible: true }).first()).toBeVisible();
  await expect(
    page
      .getByText(isPhone(page) ? "Vendas encerradas" : "Evento cancelado")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar ingresso" })).toHaveCount(0);
});

test("an event that has started no longer sells", async ({ page }) => {
  await page.goto("/e/festival-comecou");

  await expect(
    page.getByText("O evento já começou").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Vendas encerradas").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar ingresso" })).toHaveCount(0);
});

test("an unknown event answers 404", async ({ page }) => {
  const response = await page.goto("/e/nao-existe");
  expect(response?.status()).toBe(404);
});
