import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

// The checkout of SPEC-014 9C.2, signed in through the test session, against the simulated API.
// Every test opens its own scenario event (e2e/mock-api.mjs), so tests never share a state.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

async function openScenarios(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem("access-e2e-session", "1"));
  await page.goto(`/e/festival-de-cenarios-${randomUUID().slice(0, 8)}`);
  // The header shows the account once the test session is on.
  await expect(
    page.getByRole("button", { name: isPhone(page) ? "Seus ingressos" : "comprador@example.com" }),
  ).toBeVisible();
}

function chooser(page: Page) {
  return isPhone(page)
    ? page.getByRole("dialog", { name: "Escolha seu ingresso" })
    : page.getByRole("complementary").getByRole("region", { name: "Comprar ingresso" });
}

async function choose(page: Page, ticketType: string, quantity = 1): Promise<void> {
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Comprar ingresso" }).click();
  }
  const panel = chooser(page);
  await panel.getByRole("radio", { name: new RegExp(ticketType) }).click();
  for (let count = 1; count < quantity; count += 1) {
    await panel.getByRole("button", { name: "Aumentar a quantidade" }).click();
  }
}

function continueButton(page: Page) {
  return chooser(page).getByRole("button", {
    name: isPhone(page) ? "Continuar" : "Comprar ingresso",
  });
}

async function toReview(page: Page, ticketType: string, quantity = 1): Promise<void> {
  await choose(page, ticketType, quantity);
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}$/);
}

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

function primaryAction(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name }).filter({ visible: true });
}

test("reviews the order with its fee, survives a reload and shows the Pix", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openScenarios(page);
  await toReview(page, "Pista", 2);

  await expect(visible(page, "2 × Pista")).toBeVisible();
  await expect(visible(page, "Taxa de serviço")).toBeVisible();
  await expect(visible(page, "R$ 264,00")).toBeVisible();

  await page.reload();
  await expect(visible(page, "2 × Pista")).toBeVisible();

  await primaryAction(page, "Gerar Pix").click();
  await expect(page.getByRole("region", { name: "Pague com Pix" })).toBeVisible();
  await expect(visible(page, "Aguardando")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR Code do Pix" })).toBeVisible();

  await page.getByRole("button", { name: "Copiar código" }).click();
  await expect(page.getByRole("button", { name: "Código copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^00020126/);
});

test("a total below the Pix minimum stays on the chooser until the choice changes", async ({
  page,
}) => {
  await openScenarios(page);
  await choose(page, "Meia");
  await continueButton(page).click();

  await expect(visible(page, /O Pix não aceita um pedido tão baixo agora/)).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();

  await chooser(page).getByRole("button", { name: "Aumentar a quantidade" }).click();
  await expect(continueButton(page)).toBeEnabled();
  await expect(page.getByText(/O Pix não aceita um pedido tão baixo agora/)).toHaveCount(0);
});

test("a total above the Pix maximum asks for less", async ({ page }) => {
  await openScenarios(page);
  await choose(page, "Mesa");
  await continueButton(page).click();

  await expect(visible(page, /O Pix não aceita um pedido tão alto/)).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
});

test("a type that sold out on continuing shows as sold out", async ({ page }) => {
  await openScenarios(page);
  await choose(page, "Lote 1");
  await continueButton(page).click();

  await expect(visible(page, "Ingressos esgotados")).toBeVisible();
  await expect(visible(page, /Os ingressos de Lote 1 acabaram/)).toBeVisible();
  await expect(chooser(page).getByRole("radio", { name: /Lote 1/ })).toBeDisabled();
});

test("an order that could not be created can be tried again", async ({ page }) => {
  await openScenarios(page);
  await choose(page, "Lote 2");
  await continueButton(page).click();

  await expect(visible(page, "Não deu para continuar")).toBeVisible();
  await expect(continueButton(page)).toBeEnabled();
});

test("a new total is shown before the Pix, and confirmed", async ({ page }) => {
  await openScenarios(page);
  await toReview(page, "Lote 3");
  await expect(visible(page, "R$ 132,00")).toBeVisible();

  await primaryAction(page, "Gerar Pix").click();
  await expect(visible(page, "O total mudou")).toBeVisible();
  await expect(visible(page, "R$ 133,80")).toBeVisible();

  await primaryAction(page, "Gerar Pix").click();
  await expect(page.getByRole("region", { name: "Pague com Pix" })).toBeVisible();
});

test("a connection error keeps the order and tries again", async ({ page }) => {
  await openScenarios(page);
  await toReview(page, "Lote 4");

  await primaryAction(page, "Gerar Pix").click();
  await expect(visible(page, "Sem conexão")).toBeVisible();

  await primaryAction(page, "Tentar de novo").click();
  await expect(page.getByRole("region", { name: "Pague com Pix" })).toBeVisible();
});

test("an expired reservation is created again with the same choice", async ({ page }) => {
  await openScenarios(page);
  await toReview(page, "Lote 5");
  const first = page.url();

  await primaryAction(page, "Gerar Pix").click();
  await expect(page.getByRole("region", { name: "Pague com Pix" })).toBeVisible();
  expect(page.url()).not.toBe(first);
});

test("an expired reservation whose type sold out offers another choice", async ({ page }) => {
  await openScenarios(page);
  await toReview(page, "Lote 6");

  await primaryAction(page, "Gerar Pix").click();
  await expect(
    visible(page, /acabaram enquanto você revisava o pedido. Nada foi cobrado./),
  ).toBeVisible();

  await primaryAction(page, isPhone(page) ? "Escolher outro" : "Escolher outro ingresso").click();
  await expect(page).toHaveURL(/\/e\/festival-de-cenarios-/);
});

test("a payment that did not complete starts a new order", async ({ page }) => {
  await openScenarios(page);
  await toReview(page, "Lote 7");
  const first = page.url();

  await primaryAction(page, "Gerar Pix").click();
  await expect(visible(page, "Não concluído")).toBeVisible();

  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page).not.toHaveURL(first);
  await expect(primaryAction(page, "Gerar Pix")).toBeVisible();
});

test("an order that is not the buyer's is not found", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("access-e2e-session", "1"));
  await page.goto(`/checkout/${randomUUID()}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
