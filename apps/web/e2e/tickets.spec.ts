import { expect, type Page, test, type TestInfo } from "@playwright/test";

// Meus ingressos and the opened ticket (SPEC-014 9D) with the simulated API (e2e/mock-api.mjs).
// Each test asks for a buyer scenario on its own token, "buyer:<scenario>~<test>", so the reads the
// API counts (a failure once, a ticket issued on its third read) never mix between tests. The events
// follow the Figma screens at days from today: Festival de Inverno (two tickets), Noite de Jazz,
// Feira Criativa and Encontro de Makers ahead; Workshop de Foto (cancelled), Show de Verão, Festa
// Junina and Noite de Poesia behind.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

async function useBuyer(page: Page, scenario: string, info: TestInfo): Promise<void> {
  const session = `buyer:${scenario}~${info.testId}`;
  await page.addInitScript((value) => {
    window.localStorage.setItem("access-e2e-session", value);
  }, session);
}

/** The id of a ticket of the scenario: its event's position and its own, from 0. */
const ticketId = (event: number, index: number): string =>
  `9d000000-0000-4000-8000-${String(event * 10 + index + 1).padStart(12, "0")}`;

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

const qrCode = (page: Page) =>
  page.getByRole("img", { name: "QR Code do ingresso" }).filter({ visible: true });

// The Ingresso that shows this text: on the phone the carousel lays out every ticket of the event.
const ticketCard = (page: Page, text: string) =>
  page.getByRole("article").filter({ hasText: text }).filter({ visible: true });

const qrOf = (page: Page, text: string) =>
  ticketCard(page, text).getByRole("img", { name: "QR Code do ingresso" });

/** Drags the phone's carousel from right to left, to the next ticket. */
async function swipeLeft(page: Page): Promise<void> {
  const box = await page.getByRole("region", { name: /ingressos?$/ }).boundingBox();
  if (box === null) {
    throw new Error("The carousel has no box.");
  }
  const y = box.y + box.height / 3;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, y, { steps: 12 });
  await page.mouse.up();
}

test.describe("Meus ingressos", () => {
  test("Próximos shows the next event and the others, each opening its first ticket", async ({
    page,
  }, info) => {
    await useBuyer(page, "full", info);
    await page.goto("/me/tickets");

    await expect(page.getByRole("heading", { level: 1, name: "Meus ingressos" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Próximos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // The next event: its count and type, and "Mostrar ingresso" to its first ticket (M1).
    await expect(visible(page, "Festival de Inverno")).toBeVisible();
    await expect(visible(page, "2 ingressos")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mostrar ingresso" })).toHaveAttribute(
      "href",
      `/me/tickets/${ticketId(0, 0)}`,
    );
    // "Ver evento" only in the desktop's Destaque largo.
    const event = page.getByRole("link", { name: "Ver evento" }).filter({ visible: true });
    if (isPhone(page)) {
      await expect(event).toHaveCount(0);
    } else {
      await expect(event).toHaveAttribute("href", "/e/inverno");
    }

    // The others, from the soonest, each card opening its first ticket (M6, M7).
    await expect(page.getByRole("heading", { name: "Mais próximos" })).toBeVisible();
    const others = page.getByRole("tabpanel").getByRole("listitem").filter({ visible: true });
    await expect(others).toHaveCount(3);
    await expect(others.nth(0)).toContainText("Noite de Jazz");
    await expect(others.nth(1)).toContainText("Feira Criativa");
    await expect(others.nth(2)).toContainText("Encontro de Makers");
    await expect(page.getByText("Show de Verão")).toHaveCount(0);

    await others.nth(0).getByRole("link").click();
    await expect(page).toHaveURL(`/me/tickets/${ticketId(1, 0)}`);
  });

  test("Anteriores lists cancelled and past events, latest first, and keeps the tab in the URL", async ({
    page,
  }, info) => {
    await useBuyer(page, "full", info);
    await page.goto("/me/tickets");

    await page.getByRole("tab", { name: "Anteriores" }).click();
    await expect(page).toHaveURL("/me/tickets?aba=anteriores");
    const cards = page.getByRole("tabpanel").getByRole("listitem").filter({ visible: true });
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText("Workshop de Foto");
    await expect(cards.nth(0)).toContainText("Cancelado");
    // A past event without check-in: faded, without a badge (M3).
    await expect(cards.nth(1)).toContainText("Show de Verão");
    await expect(cards.nth(1)).not.toContainText(/Cancelado|Utilizado/);
    await expect(cards.nth(2)).toContainText("Festa Junina");
    await expect(cards.nth(3)).toContainText("Noite de Poesia");
    await expect(cards.nth(1).getByRole("link")).toHaveAttribute(
      "href",
      `/me/tickets/${ticketId(4, 0)}`,
    );

    await page.reload();
    await expect(page.getByRole("tab", { name: "Anteriores" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Próximos" }).click();
    await expect(page).toHaveURL("/me/tickets");
  });

  test("an unknown tab opens Próximos", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto("/me/tickets?aba=outra");
    await expect(page.getByRole("tab", { name: "Próximos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("without tickets, both tabs explain it", async ({ page }, info) => {
    await useBuyer(page, "empty", info);
    await page.goto("/me/tickets");
    await expect(page.getByRole("heading", { name: "Nenhum ingresso por aqui" })).toBeVisible();
    await page.getByRole("tab", { name: "Anteriores" }).click();
    await expect(page.getByRole("heading", { name: "Nenhum evento anterior" })).toBeVisible();
  });

  test("with only past tickets, Próximos points to Anteriores", async ({ page }, info) => {
    await useBuyer(page, "past", info);
    await page.goto("/me/tickets");
    await expect(page.getByRole("heading", { name: "Nenhum evento pela frente" })).toBeVisible();
    await expect(
      visible(page, "Os ingressos de eventos que já passaram estão em Anteriores."),
    ).toBeVisible();
  });

  test("a failed read offers Tentar de novo", async ({ page }, info) => {
    await useBuyer(page, "failure-once", info);
    await page.goto("/me/tickets");
    await expect(visible(page, "Sem conexão")).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(visible(page, "Festival de Inverno")).toBeVisible();
  });

  test("a refused session asks for the code again", async ({ page }, info) => {
    await useBuyer(page, "expired", info);
    await page.goto("/me/tickets");
    await expect(page.getByRole("dialog", { name: "Entre no Access" })).toBeVisible();
  });
});

test.describe("opened ticket", () => {
  test("shows the event's tickets, changes between them and goes back", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto(`/me/tickets/${ticketId(0, 0)}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Festival de Inverno" }),
    ).toBeAttached();
    await expect(qrOf(page, "AX-0042")).toBeVisible();

    if (isPhone(page)) {
      await expect(visible(page, "Ingresso 1 de 2 · deslize para ver o outro")).toBeVisible();
      // Swipe to the second ticket: the route follows (M11).
      await swipeLeft(page);
      await expect(visible(page, "Ingresso 2 de 2 · deslize para ver o outro")).toBeVisible();
      await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
      await expect(qrOf(page, "AX-0043")).toBeVisible();
      // No tabs on the opened ticket (SPEC-016 S4).
      await expect(page.getByRole("navigation", { name: "Navegação" })).toHaveCount(0);
      await page.getByRole("button", { name: "Voltar" }).click();
    } else {
      await expect(page.getByRole("heading", { name: "Seus 2 ingressos" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Ingresso 1 · Pista/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.getByRole("link", { name: /Ingresso 2 · Pista/ }).click();
      await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
      await expect(qrOf(page, "AX-0043")).toBeVisible();
      await expect(qrOf(page, "AX-0042")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Ingresso 2 · Pista/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.getByRole("link", { name: "Voltar" }).click();
    }
    await expect(page).toHaveURL("/me/tickets");
  });

  test("the history brings back the ticket that was in view", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto(`/me/tickets/${ticketId(0, 0)}`);
    await expect(qrOf(page, "AX-0042")).toBeVisible();
    if (isPhone(page)) {
      await swipeLeft(page);
      await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
      await page.getByRole("button", { name: "Voltar" }).click();
    } else {
      await page.getByRole("link", { name: /Ingresso 2 · Pista/ }).click();
      await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
      await page.getByRole("link", { name: "Voltar" }).click();
    }
    await expect(page).toHaveURL("/me/tickets");
    await page.goBack();
    await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
    await expect(qrOf(page, "AX-0043")).toBeVisible();
    if (isPhone(page)) {
      await expect(visible(page, "Ingresso 2 de 2 · deslize para ver o outro")).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: /Ingresso 2 · Pista/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("moves between the tickets with the keyboard", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto(`/me/tickets/${ticketId(0, 0)}`);
    await expect(qrOf(page, "AX-0042")).toBeVisible();
    if (isPhone(page)) {
      await page.getByRole("region", { name: "Seus 2 ingressos" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(visible(page, "Ingresso 2 de 2 · deslize para ver o outro")).toBeVisible();
    } else {
      await page.getByRole("link", { name: /Ingresso 2 · Pista/ }).focus();
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(`/me/tickets/${ticketId(0, 1)}`);
  });

  test("a failed list offers Tentar de novo instead of a ticket without its event's others", async ({
    page,
  }, info) => {
    await useBuyer(page, "failure-once", info);
    await page.goto(`/me/tickets/${ticketId(0, 0)}`);
    await expect(visible(page, "Sem conexão")).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(qrOf(page, "AX-0042")).toBeVisible();
    if (isPhone(page)) {
      await expect(visible(page, "Ingresso 1 de 2 · deslize para ver o outro")).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Seus 2 ingressos" })).toBeVisible();
    }
  });

  test("goes back to Anteriores from a past event, whose ticket stays valid", async ({
    page,
  }, info) => {
    await useBuyer(page, "full", info);
    await page.goto(`/me/tickets/${ticketId(4, 0)}`);
    await expect(qrCode(page)).toBeVisible();
    await expect(visible(page, "Válido")).toBeVisible();
    await page
      .getByRole(isPhone(page) ? "button" : "link", { name: "Voltar" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL("/me/tickets?aba=anteriores");
  });

  test("a cancelled event's ticket is Cancelado and never shows the QR", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto(`/me/tickets/${ticketId(5, 0)}`);
    await expect(visible(page, "Evento cancelado ou ingresso invalidado.")).toBeVisible();
    // The API signs its token anyway; the screen does not draw it (M3).
    await expect(qrCode(page)).toHaveCount(0);
    if (!isPhone(page)) {
      await expect(
        visible(page, "Este evento foi cancelado. Fale com quem organiza sobre o reembolso."),
      ).toBeVisible();
    }
  });

  test("a ticket being issued is read again until it is ready", async ({ page }, info) => {
    test.setTimeout(60_000);
    await useBuyer(page, "issuing", info);
    await page.goto(`/me/tickets/${ticketId(0, 1)}`);
    await expect(ticketCard(page, "Emitindo")).toBeVisible();
    await expect(qrOf(page, "Emitindo")).toHaveCount(0);
    // Ready on its third read, five seconds apart; its code shows in the list too on the desktop.
    await expect(qrOf(page, "AX-0043")).toBeVisible({ timeout: 20_000 });
    if (!isPhone(page)) {
      await expect(page.getByRole("link", { name: /Ingresso 2 · Pista/ })).toContainText(
        "Código AX-0043",
      );
    }
  });

  test("another person's ticket and an invalid id answer 404", async ({ page }, info) => {
    await useBuyer(page, "full", info);
    await page.goto("/me/tickets/9d000000-0000-4000-8000-0000000fffff");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await page.goto("/me/tickets/nao-e-um-id");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
