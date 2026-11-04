import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "@playwright/test";

// The event of SPEC-015 15D: the draft in three passos, the details in four, the event page with
// the edition by section, and the publication, signed in through the test session as the producer
// of a scenario of the simulated API (e2e/mock-api.mjs), which keeps each session's events.
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

const mockApi = "http://localhost:3101/api";

// The example events of the Figma screens (e2e/mock-api.mjs, fixtureIds).
const exampleDraft = "e5000000-0000-4000-8000-000000000001";
const draftWithoutCover = "e5000000-0000-4000-8000-000000000002";

/** A scenario with its own events, so tests running side by side never share a state. */
const own = (scenario: string): string => `${scenario}~${randomUUID().slice(0, 8)}`;

async function signIn(page: Page, session: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("access-e2e-session", value);
  }, session);
}

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name }).filter({ visible: true });

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

/** Nothing below the fold: the form fits the screen with its action (design guide, R10). */
async function expectNoScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
    .toBeLessThanOrEqual(0);
}

/** A window or a sheet fits the screen too, without scrolling inside. */
async function expectDialogFits(dialog: Locator): Promise<void> {
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        // Only the parts that scroll (the sheet's content), not what is merely clipped (sr-only).
        const inner = [element, ...element.querySelectorAll("*")].some(
          (node) =>
            ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight + 1,
        );
        return box.top >= 0 && box.bottom <= window.innerHeight && !inner;
      }),
    )
    .toBe(true);
}

/** DD/MM/AAAA a year from today, in Brasília's calendar. */
function nextYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

// A small PNG, a cover the simulated R2 serves back.
const png = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAGklEQVR4nGP8z8BQz0AEYBxVSFUBAJq0Afuw4ByDAAAAAElFTkSuQmCC",
    "base64",
  ),
});

async function chooseCover(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(file);
}

/** The session's events, as the simulated API keeps them. */
async function sessionEvents(
  page: Page,
  session: string,
): Promise<
  Array<{ id: string; name: string; status: string; capacity: number; coverUrl: string | null }>
> {
  const response = await page.request.get(`${mockApi}/events`, {
    headers: { Authorization: `Bearer e2e-session-token:${session}` },
  });
  return (await response.json()) as Array<{
    id: string;
    name: string;
    status: string;
    capacity: number;
    coverUrl: string | null;
  }>;
}

/** The draft's three passos, up to the details' first passo. */
async function createDraft(page: Page, name: string): Promise<string> {
  await page.goto("/producer/events/new");
  await field(page, "Nome").fill(name);
  await page.getByText("Festivais", { exact: true }).click();
  await button(page, "Continuar").click();
  await field(page, "Data de início").fill(nextYear());
  await field(page, "Horário de início").fill("21:00");
  await button(page, "Continuar").click();
  await field(page, "Número de pessoas").fill("300");
  await button(page, "Criar rascunho").click();
  await expect(page).toHaveURL(/\/producer\/events\/[0-9a-f-]{36}\/details$/);
  return /\/events\/([0-9a-f-]{36})\//.exec(page.url())![1]!;
}

test.describe("Novo evento", () => {
  test("creates the draft in three passos, saying when the start already passed", async ({
    page,
  }) => {
    const session = own("events");
    await signIn(page, session);
    await page.goto("/producer/events/new");
    await expect(visible(page, "Rascunho · 1 de 3")).toBeVisible();

    // Continuar with nothing: what to write and what to choose.
    await button(page, "Continuar").click();
    await expect(visible(page, "Escreva o nome do evento.")).toBeVisible();
    await expect(visible(page, "Escolha uma categoria.")).toBeVisible();
    await expectNoScroll(page);
    await field(page, "Nome").fill("Festival de Primavera");
    await page.getByText("Festivais", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Festivais" })).toBeChecked();
    await expect(page.getByText("Escreva o nome do evento.")).toHaveCount(0);
    await button(page, "Continuar").click();

    // Data e horário: a start that already passed (595:14202).
    await expect(page).toHaveURL(/\/producer\/events\/new\?passo=2$/);
    await field(page, "Data de início").fill("12102025");
    await expect(field(page, "Data de início")).toHaveValue("12/10/2025");
    await field(page, "Horário de início").fill("2100");
    await expect(field(page, "Horário de início")).toHaveValue("21:00");
    await button(page, "Continuar").click();
    await expect(visible(page, "Já passou. Use uma data futura.")).toBeVisible();
    await expect(page).toHaveURL(/\?passo=2$/);
    await expectNoScroll(page);
    // An end before the start.
    await field(page, "Data de início").fill(nextYear());
    await field(page, "Término (opcional)").fill(nextYear());
    await field(page, "Horário de término").fill("20:00");
    await button(page, "Continuar").click();
    await expect(visible(page, "O término precisa ser depois do início.")).toBeVisible();
    await field(page, "Horário de término").fill("23:30");
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\?passo=3$/);
    await button(page, "Criar rascunho").click();
    await expect(visible(page, "Informe quantas pessoas o evento comporta.")).toBeVisible();
    await field(page, "Número de pessoas").fill("300");
    await expectNoScroll(page);
    await button(page, "Criar rascunho").click();

    await expect(page).toHaveURL(/\/producer\/events\/[0-9a-f-]{36}\/details$/);
    await expect(visible(page, "Rascunho criado. O resto pode ficar para depois.")).toBeVisible();
    await expect(visible(page, "Detalhes · 1 de 4")).toBeVisible();
    await expectNoScroll(page);
    const created = (await sessionEvents(page, session)).filter(
      (event) => event.name === "Festival de Primavera",
    );
    expect(created).toEqual([expect.objectContaining({ status: "draft", capacity: 300 })]);
  });

  test("a passo not yet open leads to the first pending one", async ({ page }) => {
    await signIn(page, own("events"));
    await page.goto("/producer/events/new?passo=3");
    await expect(page).toHaveURL(/\/producer\/events\/new$/);
    await expect(visible(page, "Nome e categoria")).toBeVisible();
  });

  test("goes back from the details to the creation without another draft", async ({ page }) => {
    const session = own("events");
    await signIn(page, session);
    await createDraft(page, "Festival de Outono");

    // Back from the details: what was saved, and Continuar saves the changes.
    await page.goBack();
    await expect(page).toHaveURL(/\/producer\/events\/new\?passo=3$/);
    await expect(field(page, "Número de pessoas")).toHaveValue("300");
    await expect(button(page, "Criar rascunho")).toHaveCount(0);
    await field(page, "Número de pessoas").fill("350");
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/details$/);

    const drafts = (await sessionEvents(page, session)).filter(
      (event) => event.name === "Festival de Outono",
    );
    expect(drafts).toEqual([expect.objectContaining({ capacity: 350 })]);
  });
});

test.describe("Detalhes do evento", () => {
  test("goes through the city, the cover and the ticket types up to the event page", async ({
    page,
  }) => {
    const session = own("events");
    await signIn(page, session);
    const id = await createDraft(page, "Festival de Verão");

    // 1 Local: the city from the IBGE base (588:11602).
    await page.getByRole("textbox", { name: "Local", exact: true }).fill("Casa Fluida");
    await page.getByRole("combobox", { name: "Cidade" }).fill("Camp");
    await expect(page.getByRole("option", { name: "Campinas, SP" })).toBeVisible();
    await expectNoScroll(page);
    await page.getByRole("option", { name: "Campinas, SP" }).click();
    await expect(page.getByRole("combobox", { name: "Cidade" })).toHaveValue("Campinas, SP");
    await field(page, "Endereço").fill("Rua Augusta, 1200");
    await button(page, "Continuar").click();

    // 2 Capa: a file too large, another type, then the cover and its swap (590:11903).
    await expect(page).toHaveURL(/\/details\?passo=2$/);
    await chooseCover(page, {
      name: "capa-grande.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(Math.round(8.4 * 1024 * 1024)),
    });
    await expect(
      visible(page, "O arquivo tem 8,4 MB. Envie JPG, PNG ou WebP até 5 MB."),
    ).toBeVisible();
    await expect(button(page, "Escolher outro arquivo")).toBeVisible();
    await expectNoScroll(page);
    await chooseCover(page, {
      name: "capa.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("GIF89a"),
    });
    await expect(
      visible(
        page,
        "Envie JPG, PNG ou WebP até 5 MB. Imagens fora de 16:9 são cortadas no centro.",
      ),
    ).toBeVisible();
    await chooseCover(page, png("capa.png"));
    await expect(button(page, "Trocar capa")).toBeVisible();
    const first = (await sessionEvents(page, session)).find((event) => event.id === id)!.coverUrl;
    expect(first).toMatch(new RegExp(`/__r2/events/${id}/[0-9a-f-]{36}\\.png$`));
    await chooseCover(page, png("outra-capa.png"));
    await expect
      .poll(
        async () => (await sessionEvents(page, session)).find((event) => event.id === id)!.coverUrl,
      )
      .not.toBe(first);
    await expect(button(page, "Trocar capa")).toBeVisible();
    await button(page, "Continuar").click();

    // 3 Tipos de ingresso: the minimum and the capacity, then the type in the list.
    await expect(page).toHaveURL(/\/details\?passo=3$/);
    await button(page, "Adicionar tipo de ingresso").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Novo tipo de ingresso")).toBeVisible();
    await field(page, "Nome").fill("Pista");
    await field(page, "Preço").fill("40");
    await field(page, "Quantidade").fill("400");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("O mínimo é R$ 60,00.")).toBeVisible();
    await expect(dialog.getByText("Passa da capacidade: use até 300.")).toBeVisible();
    await expectDialogFits(dialog);
    await field(page, "Preço").fill("120");
    await field(page, "Quantidade").fill("120");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(visible(page, "120 de 300 lugares nos tipos")).toBeVisible();
    await expect(visible(page, "R$ 120,00")).toBeVisible();
    await expect(page).toHaveURL(/\/details\?passo=3$/);
    await expectNoScroll(page);
    await button(page, "Continuar").click();

    // 4 Descrição e reembolso, then the event page.
    await expect(page).toHaveURL(/\/details\?passo=4$/);
    await field(page, "Descrição").fill("Uma tarde de música ao ar livre.");
    await field(page, "Política de reembolso").fill(
      "Reembolso integral até 7 dias antes do evento.",
    );
    await expectNoScroll(page);
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(new RegExp(`/producer/events/${id}$`));
    await expect(visible(page, "Casa Fluida · Campinas, SP")).toBeVisible();
    await expect(visible(page, "1 tipo · 120 de 300 lugares")).toBeVisible();
    await expect(visible(page, "Reembolso integral até 7 dias antes do evento.")).toBeVisible();
    await expect(visible(page, "Enviada")).toBeVisible();
  });

  test("any passo of the details opens straight, also on a reload", async ({ page }) => {
    await signIn(page, own("events"));
    await page.goto(`/producer/events/${exampleDraft}/details?passo=3`);
    await expect(page).toHaveURL(new RegExp(`/${exampleDraft}/details\\?passo=3$`));
    await expect(visible(page, "Detalhes · 3 de 4")).toBeVisible();
    await page.reload();
    await expect(visible(page, "Detalhes · 3 de 4")).toBeVisible();

    // Past the last passo, the last one.
    await page.goto(`/producer/events/${exampleDraft}/details?passo=9`);
    await expect(page).toHaveURL(new RegExp(`/${exampleDraft}/details\\?passo=4$`));
  });
});

test.describe("Página do evento", () => {
  test("edits a section, and Cancelar or the back discard", async ({ page }) => {
    await signIn(page, own("events"));
    await page.goto(`/producer/events/${exampleDraft}`);

    await page.getByRole("link", { name: "Editar Data e horário" }).click();
    await expect(page).toHaveURL(new RegExp(`/${exampleDraft}\\?editar=data$`));
    await expect(visible(page, "Editar")).toBeVisible();
    await expectNoScroll(page);
    await field(page, "Horário de início").fill("22:30");
    await button(page, "Salvar").click();
    await expect(page).toHaveURL(new RegExp(`/${exampleDraft}$`));
    await expect(visible(page, /· 22:30 às/)).toBeVisible();

    await page.getByRole("link", { name: "Editar Capacidade" }).click();
    await field(page, "Número de pessoas").fill("10");
    // A draft's capacity may go below its types; the publication then says it does not fit.
    await (isPhone(page) ? button(page, "Voltar") : button(page, "Cancelar")).click();
    await expect(page).toHaveURL(new RegExp(`/${exampleDraft}$`));
    await expect(visible(page, "300 pessoas")).toBeVisible();
  });

  test("a published event keeps the capacity above its types", async ({ page }) => {
    await signIn(page, own("events"));
    await page.goto(`/producer/events/e5000000-0000-4000-8000-000000000003?editar=capacidade`);
    await field(page, "Número de pessoas").fill("100");
    await button(page, "Salvar").click();
    await expect(visible(page, "Os tipos já somam 150 lugares. Use 150 ou mais.")).toBeVisible();
    await expectNoScroll(page);
  });
});

/** The publication's requirements: the desktop's card, or the phone's sheet. */
async function openRequirements(page: Page): Promise<Locator> {
  if (isPhone(page)) {
    await button(page, "Publicar evento").click();
    const sheet = page.getByRole("dialog", { name: "Publicar evento" });
    await expect(sheet).toBeVisible();
    return sheet;
  }
  return page.getByRole("region", { name: "Publicação" });
}

const verificationStates = [
  {
    scenario: "events-verifying",
    line: "Verificação em análise",
    detail: "Publicar fica liberado quando a BlindPay aprovar.",
    action: null,
    reason: "Falta a verificação ser aprovada.",
  },
  {
    scenario: "events-rfi",
    line: "Pedido de informações da BlindPay",
    detail: "Responda para a verificação seguir.",
    action: "Responder",
    reason: "Falta a verificação ser aprovada.",
  },
  {
    scenario: "events-rejected",
    line: "Verificação recusada",
    detail: "Corrija os dados e envie de novo.",
    action: "Corrigir",
    reason: "Falta a verificação ser aprovada.",
  },
  {
    scenario: "events-releasing",
    line: "Liberando o recebimento",
    detail: "Publicar fica liberado em instantes.",
    action: null,
    reason: "Falta o recebimento ser liberado.",
  },
  {
    scenario: "events-setup",
    line: "Verificação pendente",
    detail: "Termine a configuração do recebimento.",
    action: "Configurar",
    reason: "Falta a verificação ser aprovada.",
  },
  {
    scenario: "events-account-failed",
    line: "Conta de recebimento com erro",
    detail: "Prepare a conta de novo no Recebimento.",
    action: "Resolver",
    reason: "Falta a conta de recebimento ficar pronta.",
  },
] as const;

test.describe("Publicação", () => {
  for (const state of verificationStates) {
    test(`is blocked while ${state.line.toLowerCase()} (E6)`, async ({ page }) => {
      await signIn(page, own(state.scenario));
      await page.goto(`/producer/events/${exampleDraft}`);
      if (isPhone(page)) {
        await expect(visible(page, "Falta 1 item para publicar")).toBeVisible();
      }
      const requirements = await openRequirements(page);
      await expect(requirements.getByText(state.line)).toBeVisible();
      await expect(requirements.getByText(state.detail)).toBeVisible();
      if (state.action === null) {
        await expect(requirements.getByRole("link")).toHaveCount(0);
      } else {
        await expect(requirements.getByRole("link", { name: state.action })).toHaveAttribute(
          "href",
          "/producer/receiving",
        );
      }
      await expect(requirements.getByText(state.reason)).toBeVisible();
      await expect(requirements.getByRole("button", { name: "Publicar evento" })).toBeDisabled();
      await expectNoScroll(page);
    });
  }

  test("says what the event still misses and leads to it (595:13914)", async ({ page }) => {
    await signIn(page, own("events-verifying"));
    await page.goto(`/producer/events/${draftWithoutCover}`);
    await expect(visible(page, "Falta enviar · obrigatória para publicar")).toBeVisible();
    const requirements = await openRequirements(page);
    await expect(
      requirements.getByText("Falta a verificação ser aprovada e a capa do evento."),
    ).toBeVisible();
    await requirements.getByRole("link", { name: "Enviar capa" }).click();
    await expect(page).toHaveURL(new RegExp(`/${draftWithoutCover}\\?editar=capa$`));
    await chooseCover(page, png("capa.png"));
    await expect(button(page, "Trocar capa")).toBeVisible();
    await button(page, "Concluir").click();
    await expect(page).toHaveURL(new RegExp(`/${draftWithoutCover}$`));
    await expect(visible(page, "Enviada")).toBeVisible();
  });

  test("publishes, with the confirmation on the phone, and shares the link", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, own("events"));
    await page.goto(`/producer/events/${exampleDraft}`);

    if (isPhone(page)) {
      await expect(visible(page, "Pronto para publicar")).toBeVisible();
      const sheet = await openRequirements(page);
      await expect(
        sheet.getByText("Ao publicar, o evento entra na vitrine e as vendas abrem."),
      ).toBeVisible();
      await expectDialogFits(sheet);
      await sheet.getByRole("button", { name: "Publicar evento" }).click();
      await expect(sheet).toHaveCount(0);
      await expect(visible(page, "À venda")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver página" })).toHaveAttribute(
        "href",
        "/e/festival-de-inverno",
      );
      await button(page, "Copiar link").click();
    } else {
      const card = page.getByRole("region", { name: "Publicação" });
      await expect(card.getByText("Tudo pronto: o evento pode ir para o ar.")).toBeVisible();
      await card.getByRole("button", { name: "Publicar evento" }).click();
      const onSale = page.getByRole("region", { name: "À venda" });
      await expect(onSale.getByRole("textbox", { name: "Link do evento" })).toHaveValue(
        `${new URL(page.url()).host}/e/festival-de-inverno`,
      );
      await expect(page.getByRole("link", { name: "Ver página" })).toHaveAttribute(
        "href",
        "/e/festival-de-inverno",
      );
      await onSale.getByRole("button", { name: "Copiar link" }).click();
    }
    await expect(button(page, "Link copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${new URL(page.url()).origin}/e/festival-de-inverno`,
    );
    await expect(visible(page, "Publicado")).toBeVisible();
    await expectNoScroll(page);
  });

  test("a producer no longer ready is read again and blocks it", async ({ page }) => {
    await signIn(page, own("events-not-ready"));
    await page.goto(`/producer/events/${exampleDraft}`);
    const requirements = await openRequirements(page);
    await expect(requirements.getByText("Verificação aprovada")).toBeVisible();
    await requirements.getByRole("button", { name: "Publicar evento" }).click();
    await expect(requirements.getByText("Verificação em análise")).toBeVisible();
    await expect(requirements.getByRole("button", { name: "Publicar evento" })).toBeDisabled();
  });
});
