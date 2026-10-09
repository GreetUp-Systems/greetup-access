import { expect, type Page, test } from "@playwright/test";

// The public site's frame of SPEC-016 16A with the simulated API (e2e/mock-api.mjs): the header and
// the account menu by session, the Conta, "Sair", the tabs, the footer, the visitor in the buyer
// area and the event page's header. The session comes from the test session: "anonymous" is the
// visitor, "1" the buyer and a scenario's name a producer.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

async function useSession(page: Page, value: string): Promise<void> {
  await page.addInitScript((session) => {
    window.localStorage.setItem("access-e2e-session", session);
  }, value);
}

// Only on the first page, so "Sair" (which stores the visitor) holds on the next one.
async function startSession(page: Page, value: string): Promise<void> {
  await page.addInitScript((session) => {
    if (window.localStorage.getItem("access-e2e-session") === null) {
      window.localStorage.setItem("access-e2e-session", session);
    }
  }, value);
}

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

// The window closes with its X on the desktop; on the phone the full screen goes back.
async function closeIdentification(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: isPhone(page) ? "Voltar" : "Fechar" })
    .filter({ visible: true })
    .click();
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Menu da conta" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("event page header", () => {
  test("a visitor sees Entrar, which opens the identification and stays on the page", async ({
    page,
  }) => {
    await useSession(page, "anonymous");
    await page.goto("/e/festival-de-inverno");

    if (!isPhone(page)) {
      const header = page.getByRole("banner").filter({ visible: true });
      await expect(header.getByRole("link", { name: "Access" })).toHaveAttribute("href", "/");
      // The session has arrived before checking what the visitor does not see.
      await expect(header.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Meus ingressos" })).toHaveCount(0);
      // S5: no search and no "Para produtores" until their pages exist.
      await expect(page.getByText("Para produtores")).toHaveCount(0);
      await expect(page.getByRole("searchbox")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Entrar" }).filter({ visible: true }).click();
    await expect(page.getByRole("dialog", { name: "Entre no Access" })).toBeVisible();
    await closeIdentification(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/e\/festival-de-inverno$/);
  });

  test("a buyer sees Meus ingressos and the account menu", async ({ page }) => {
    await startSession(page, "1");
    await page.goto("/e/festival-de-inverno");

    if (isPhone(page)) {
      // S19: the account action leads to the Conta.
      await page.getByRole("button", { name: "Conta" }).click();
      await expect(page).toHaveURL(/\/me$/);
      return;
    }
    await expect(page.getByRole("link", { name: "Meus ingressos" })).toHaveAttribute(
      "href",
      "/me/tickets",
    );
    await expect(page.getByRole("link", { name: "Painel do produtor" })).toHaveCount(0);
    const menu = await openMenu(page);
    await expect(menu).toContainText("comprador@example.com");
    await expect(menu.getByRole("menuitem", { name: "Meus ingressos" })).toHaveAttribute(
      "href",
      "/me/tickets",
    );
    await expect(menu.getByRole("menuitem", { name: "Conta" })).toHaveAttribute("href", "/me");
    await expect(menu.getByRole("menuitem", { name: "Vender ingressos" })).toHaveAttribute(
      "href",
      "/producer/start",
    );
    await expect(menu.getByRole("menuitem", { name: "Painel do produtor" })).toHaveCount(0);
    await menu.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a producer also sees Painel do produtor, by the public name", async ({ page }) => {
    await useSession(page, "setup");
    await page.goto("/e/festival-de-inverno");

    if (isPhone(page)) {
      // The phone has no header menu: the account action is the same for everyone signed in.
      await expect(page.getByRole("button", { name: "Conta" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("link", { name: "Painel do produtor" })).toHaveAttribute(
      "href",
      "/producer",
    );
    const menu = await openMenu(page);
    await expect(menu).toContainText("Casa Fluida");
    await expect(menu).toContainText("CF");
    await expect(menu.getByRole("menuitem", { name: "Painel do produtor" })).toHaveAttribute(
      "href",
      "/producer",
    );
    await expect(menu.getByRole("menuitem", { name: "Vender ingressos" })).toHaveCount(0);
  });

  test("a failed producer read shows the person as a buyer", async ({ page }) => {
    // The scenario answers 503 to GET /producers/me (S18).
    await useSession(page, "failure");
    await page.goto("/e/festival-de-inverno");

    if (isPhone(page)) {
      // The Conta also shows the way to start selling, not the dashboard.
      await page.getByRole("button", { name: "Conta" }).click();
      await expect(page.getByRole("link", { name: /Vender ingressos/ })).toHaveAttribute(
        "href",
        "/producer/start",
      );
      await expect(page.getByRole("link", { name: /Painel do produtor/ })).toHaveCount(0);
      return;
    }

    await expect(page.getByRole("link", { name: "Meus ingressos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Painel do produtor" })).toHaveCount(0);
    const menu = await openMenu(page);
    await expect(menu.getByRole("menuitem", { name: "Vender ingressos" })).toBeVisible();
  });

  test("the cover is the shared link's image", async ({ page }) => {
    await page.goto("/e/festival-de-inverno");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://covers.example.com/events/festival-de-inverno.jpg",
    );

    await page.goto("/e/festival-cancelado");
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });
});

test.describe("Conta", () => {
  test("a buyer sees the e-mail, the way to start selling and Sair", async ({ page }) => {
    await useSession(page, "1");
    await page.goto("/me");

    await expect(visible(page, "comprador@example.com")).toBeVisible();
    if (isPhone(page)) {
      await expect(page.getByRole("link", { name: /Vender ingressos/ })).toHaveAttribute(
        "href",
        "/producer/start",
      );
      await expect(visible(page, "Monte um evento e venda por Pix")).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: "Começar a vender" })).toHaveAttribute(
        "href",
        "/producer/start",
      );
      await expect(
        visible(page, "Monte o evento e venda por Pix. Quem compra recebe o ingresso com QR Code."),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: "Sair" }).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText(/receba/)).toHaveCount(0);
  });

  test("a producer sees the public name and the way to the dashboard", async ({ page }) => {
    await useSession(page, "ready");
    await page.goto("/me");

    await expect(visible(page, "Casa Fluida")).toBeVisible();
    await expect(visible(page, "voce@email.com")).toBeVisible();
    const toDashboard = isPhone(page)
      ? page.getByRole("link", { name: /Painel do produtor/ })
      : page.getByRole("link", { name: "Ir para o painel" });
    await expect(toDashboard).toHaveAttribute("href", "/producer");
    await expect(page.getByRole("link", { name: "Começar a vender" })).toHaveCount(0);
  });

  test("the phone has the tabs and no footer; the desktop has the footer", async ({ page }) => {
    await useSession(page, "1");
    await page.goto("/me");
    await expect(visible(page, "comprador@example.com")).toBeVisible();

    if (isPhone(page)) {
      const tabs = page.getByRole("navigation", { name: "Navegação" });
      await expect(tabs.getByRole("link", { name: "Conta" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(tabs.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
      await expect(tabs.getByRole("link", { name: "Ingressos" })).toHaveAttribute(
        "href",
        "/me/tickets",
      );
      await expect(page.getByRole("contentinfo")).toBeHidden();
      return;
    }
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Meus ingressos" })).toHaveAttribute(
      "href",
      "/me/tickets",
    );
    await expect(footer.getByRole("link", { name: "Vender ingressos" })).toHaveAttribute(
      "href",
      "/producer/start",
    );
    await expect(footer.getByRole("link", { name: "Painel do produtor" })).toHaveAttribute(
      "href",
      "/producer",
    );
    // S16: no Explorar before 16C and no terms before their texts.
    await expect(footer.getByText("Explorar eventos")).toHaveCount(0);
    await expect(footer.getByText("Termos de uso")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navegação" })).toBeHidden();
  });

  test("Sair ends the session and goes to the Início", async ({ page }) => {
    await startSession(page, "1");
    await page.goto("/me");
    await expect(visible(page, "comprador@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/$/);

    // The session stays closed: the buyer area asks to sign in again.
    await page.goto("/me");
    await expect(page.getByRole("dialog", { name: "Entre no Access" })).toBeVisible();
  });

  test("a visitor is asked to sign in, and closing goes to the Início", async ({ page }) => {
    await useSession(page, "anonymous");
    await page.goto("/me");

    await expect(page.getByRole("dialog", { name: "Entre no Access" })).toBeVisible();
    // Nothing of the buyer area behind the identification.
    await expect(page.locator("main")).toBeEmpty();
    await closeIdentification(page);
    await expect(page).toHaveURL(/\/$/);
  });
});
