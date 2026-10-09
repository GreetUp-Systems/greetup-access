import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

// The producer system's frame of SPEC-015 15B, signed in through the test session as the producer
// of a scenario of the simulated API (e2e/mock-api.mjs): the navigation, the account, the
// profile and the events.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

async function signIn(page: Page, scenario = "ready"): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("access-e2e-session", value);
  }, scenario);
}

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

async function openAccount(page: Page): Promise<void> {
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Conta" }).click();
    await expect(page.getByRole("dialog", { name: "Casa Fluida" })).toBeVisible();
  } else {
    await page.getByRole("button", { name: /Casa Fluida/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
  }
}

test("opens the system with the producer's navigation and account", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");

  const navigation = page.getByRole("navigation", { name: "Navegação" }).filter({ visible: true });
  await expect(navigation.getByRole("link", { name: /Eventos/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "Painel" })).toHaveAttribute(
    "href",
    "/producer",
  );
  await expect(navigation.getByRole("link", { name: "Recebimento" })).toHaveAttribute(
    "href",
    "/producer/receiving",
  );
  if (isPhone(page)) {
    await expect(page.getByRole("button", { name: "Conta" })).toBeVisible();
  } else {
    // What is on sale plus the drafts.
    await expect(navigation.getByRole("link", { name: /Eventos/ })).toContainText("3");
    await expect(page.getByRole("button", { name: /Casa Fluida/ })).toContainText("voce@email.com");
  }
});

test("goes to the profile from the account and back", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");
  await openAccount(page);
  if (isPhone(page)) {
    await page.getByRole("link", { name: "Perfil do produtor" }).click();
  } else {
    await page.getByRole("menuitem", { name: "Perfil do produtor" }).click();
  }

  await expect(page).toHaveURL(/\/producer\/profile$/);
  await expect(visible(page, "Casa Fluida")).toBeVisible();
  if (isPhone(page)) {
    // An inner page: back instead of the tabs.
    await expect(page.getByRole("navigation", { name: "Navegação" })).toBeHidden();
    await expect(page.getByRole("link", { name: /Recebimento/ })).toHaveAttribute(
      "href",
      "/producer/receiving",
    );
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/producer\/events$/);
  } else {
    await expect(page.getByRole("heading", { name: "Perfil do produtor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute(
      "href",
      "/producer/receiving",
    );
  }
});

test("Sair ends the session and goes to the site", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");
  await openAccount(page);
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Sair" }).click();
  } else {
    await page.getByRole("menuitem", { name: "Sair" }).click();
  }
  await expect(page).toHaveURL(/\/$/);
});

test("the account leads to the site's places", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");
  await openAccount(page);
  const role = isPhone(page) ? "link" : "menuitem";
  await expect(page.getByRole(role, { name: "Meus ingressos" })).toHaveAttribute(
    "href",
    "/me/tickets",
  );
  await expect(page.getByRole(role, { name: "Ir para o site" })).toHaveAttribute("href", "/");
});

test("remembers the sidebar closed, and ⌘B opens it again", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");
  if (isPhone(page)) {
    // The phone has the Barra de abas instead of the sidebar.
    await expect(page.getByRole("button", { name: "Recolher barra lateral" })).toBeHidden();
    return;
  }

  await page.getByRole("button", { name: "Recolher barra lateral" }).click();
  await expect(page.getByRole("button", { name: "Abrir barra lateral" })).toBeVisible();
  // Collapsed, the items keep their names for screen readers.
  await expect(
    page.getByRole("navigation", { name: "Navegação" }).getByRole("link", { name: /Eventos/ }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Abrir barra lateral" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("button", { name: "Recolher barra lateral" })).toBeVisible();
});

test("sends an account without a producer profile to Criar perfil", async ({ page }) => {
  await signIn(page, "no-producer");
  await page.goto("/producer/events");
  await expect(page).toHaveURL(/\/producer\/start$/);
});

test("lists the events by tab, with the search on the desktop", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");

  await expect(visible(page, "Festival de Inverno")).toBeVisible();
  await expect(visible(page, "Feira Criativa")).toBeVisible();
  await expect(page.getByText("Noite de Jazz").filter({ visible: true })).toHaveCount(0);

  await page.getByRole("tab", { name: /Rascunhos/ }).click();
  await expect(visible(page, "Noite de Jazz")).toBeVisible();
  await expect(visible(page, "Ainda não está à venda")).toBeVisible();

  await page.getByRole("tab", { name: /Encerrados/ }).click();
  for (const name of [
    "Sunset Session",
    "Baile de Primavera",
    "Mostra de Curtas",
    "Feira de Outono",
  ]) {
    await expect(visible(page, name)).toBeVisible();
  }

  await page.getByRole("tab", { name: /À venda/ }).click();
  if (isPhone(page)) {
    await expect(page.getByRole("searchbox", { name: "Buscar evento" })).toBeHidden();
    return;
  }
  await page.getByRole("searchbox", { name: "Buscar evento" }).fill("inverno");
  await expect(visible(page, "Festival de Inverno")).toBeVisible();
  await expect(page.getByText("Feira Criativa").filter({ visible: true })).toHaveCount(0);
});

test("shows the system loading and offers to try again when it fails", async ({ page }) => {
  await signIn(page, `failure-once~${randomUUID().slice(0, 8)}`);
  await page.goto("/producer/events");

  await expect(visible(page, "Sem conexão")).toBeVisible();
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(visible(page, "Festival de Inverno")).toBeVisible();
});

test("says what each empty tab means, and starts the first event", async ({ page }) => {
  await signIn(page, "first-event");
  await page.goto("/producer/events");

  await expect(visible(page, "Crie seu primeiro evento")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Criar evento" }).filter({ visible: true }).last(),
  ).toHaveAttribute("href", "/producer/events/new");
  await page.getByRole("tab", { name: /Rascunhos/ }).click();
  await expect(visible(page, "Nenhum rascunho")).toBeVisible();
  await page.getByRole("tab", { name: /Encerrados/ }).click();
  await expect(visible(page, "Nenhum evento encerrado")).toBeVisible();
});

test("ends the past events and opens an event from its line", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");

  await expect(
    page.getByRole("link", { name: "Festival de Inverno" }).filter({ visible: true }),
  ).toHaveAttribute("href", "/producer/events/festival-de-inverno");

  await page.getByRole("tab", { name: /Encerrados/ }).click();
  await expect(page.getByText("Encerrado", { exact: true }).filter({ visible: true })).toHaveCount(
    3,
  );
  await expect(page.getByText("Cancelado", { exact: true }).filter({ visible: true })).toHaveCount(
    1,
  );
});

test("the row menu edits, opens the page and copies the link", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/producer/events");
  if (isPhone(page)) {
    // The phone opens the event from its line; the menu is the desktop's.
    await expect(page.getByRole("button", { name: /Ações de/ })).toHaveCount(0);
    return;
  }
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.getByRole("button", { name: "Ações de Festival de Inverno" }).click();
  await expect(page.getByRole("menuitem", { name: "Editar" })).toHaveAttribute(
    "href",
    "/producer/events/festival-de-inverno",
  );
  await expect(page.getByRole("menuitem", { name: "Ver página" })).toHaveAttribute(
    "href",
    "/e/festival-de-inverno",
  );
  await page.getByRole("menuitem", { name: "Copiar link" }).click();
  await expect(page.getByRole("menuitem", { name: "Link copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${new URL(page.url()).origin}/e/festival-de-inverno`,
  );
  await expect(page.getByRole("menu")).toBeHidden();

  // A draft has no page yet.
  await page.getByRole("tab", { name: /Rascunhos/ }).click();
  await page.getByRole("button", { name: "Ações de Noite de Jazz" }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Editar"]);
});

test("says when the search finds nothing", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer/events");
  if (isPhone(page)) {
    await expect(page.getByRole("searchbox", { name: "Buscar evento" })).toBeHidden();
    return;
  }
  await page.getByRole("searchbox", { name: "Buscar evento" }).fill("rock");
  await expect(visible(page, "Nenhum evento encontrado")).toBeVisible();
});

const receivingStates = [
  ["setup", null, "Termine a configuração para receber pelas vendas.", "Falta configurar"],
  ["verifying", "Em análise", "Seus dados estão em análise na BlindPay.", "Dados enviados"],
  ["rfi", "Pendência", "A BlindPay pediu mais informações.", "Responder pedido"],
  [
    "rejected",
    "Recusado",
    "A verificação foi recusada. Corrija os dados e envie de novo.",
    "Verificação recusada",
  ],
  ["releasing", "Aprovado", "Verificação aprovada. Liberando o recebimento…", "Liberando a conta…"],
  ["ready", "Aprovado", "Conta ativa e verificação aprovada.", "Conta ativa"],
] as const;

for (const [scenario, status, detail, short] of receivingStates) {
  test(`the profile sums up Recebimento: ${scenario}`, async ({ page }) => {
    await signIn(page, scenario);
    await page.goto("/producer/profile");
    await expect(visible(page, isPhone(page) ? short : detail)).toBeVisible();
    const badge = page.getByText(status ?? "Aprovado", { exact: true }).filter({ visible: true });
    await expect(badge).toHaveCount(status === null ? 0 : 1);
  });
}

test("the Painel shows the period's numbers, the next event and the last sales", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.goto("/producer");

  await expect(visible(page, isPhone(page) ? "Painel" : "Olá, Casa Fluida")).toBeVisible();
  await expect(visible(page, "182")).toBeVisible();
  await expect(visible(page, "21.840")).toBeVisible();
  await expect(visible(page, "12%")).toBeVisible();
  await expect(visible(page, "2 × Pista")).toBeVisible();
  await expect(visible(page, "há 5 min")).toBeVisible();

  const next = page.getByRole("region", { name: "Próximo evento" });
  await expect(next.getByText("Festival de Inverno")).toBeVisible();
  await next.getByRole("button", { name: "Copiar link" }).click();
  await expect(next.getByRole("button", { name: "Link copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${new URL(page.url()).origin}/e/festival-de-inverno`,
  );
  await expect(next.getByRole("link", { name: "Ver página" })).toHaveAttribute(
    "href",
    "/e/festival-de-inverno",
  );
});

test("the Painel changes the period of its numbers", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer");

  await page.getByRole("button", { name: "Últimos 30 dias" }).click();
  await page.getByRole("menuitemradio", { name: "Últimos 7 dias" }).click();
  await expect(page.getByRole("button", { name: "Últimos 7 dias" })).toBeVisible();
  if (!isPhone(page)) {
    await expect(visible(page, "vs. 7 dias antes")).toBeVisible();
  }
  await expect(visible(page, isPhone(page) ? "7 dias" : "Últimos 7 dias")).toBeVisible();
});

test("the Painel welcomes the ready producer once", async ({ page }) => {
  await signIn(page);
  await page.goto("/producer");

  await expect(visible(page, "Tudo pronto para vender")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Tudo pronto para vender")).toHaveCount(0);
  await page.reload();
  await expect(visible(page, "21.840")).toBeVisible();
  await expect(page.getByText("Tudo pronto para vender")).toHaveCount(0);
});

test("the Painel of a producer without events yet", async ({ page }) => {
  await signIn(page, "first-event");
  await page.goto("/producer");

  await expect(visible(page, "Nenhum evento à venda ainda.")).toBeVisible();
  await expect(visible(page, "Nenhuma venda ainda.")).toBeVisible();
  await expect(
    visible(page, "As vendas por dia aparecem aqui quando o primeiro evento estiver à venda."),
  ).toBeVisible();
  await expect(visible(page, "Crie seu primeiro evento")).toBeVisible();
});

test("the Painel pauses the sales while a request for information is open", async ({ page }) => {
  await signIn(page, "rfi");
  await page.goto("/producer");

  await expect(visible(page, "Vendas pausadas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Responder agora" })).toHaveAttribute(
    "href",
    "/producer/receiving",
  );
});

test("the Painel warns about a request that lets the sales go on", async ({ page }) => {
  await signIn(page, "approved-rfi");
  await page.goto("/producer");

  await expect(visible(page, "A BlindPay pediu informações")).toBeVisible();
  await expect(visible(page, /Responda até 3 de novembro\./)).toBeVisible();
});

test("the Painel shows the setup until the producer can sell", async ({ page }) => {
  await signIn(page, "setup");
  await page.goto("/producer");

  await expect(visible(page, "Termine a configuração para vender")).toBeVisible();
  await expect(visible(page, "1 de 5")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar" })).toHaveAttribute(
    "href",
    "/producer/receiving",
  );
  await expect(visible(page, "Monte seu primeiro evento")).toBeVisible();
  // No numbers before the producer can sell.
  await expect(page.getByRole("button", { name: "Últimos 30 dias" })).toHaveCount(0);
});
