import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "@playwright/test";

// The results of the verification and BlindPay's request for information in the Recebimento
// (SPEC-015 15C, §6 "Resultados" and "Campos do RFI"), signed in through the test session as the
// producer of a scenario of the simulated API (e2e/mock-api.mjs).
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

/** A scenario with its own counters, so tests running side by side never share a state. */
const own = (scenario: string): string => `${scenario}~${randomUUID().slice(0, 8)}`;

async function signIn(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("access-e2e-session", value);
  }, scenario);
}

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name }).filter({ visible: true });

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

/** The Etapas beside (desktop) or below (phone) the result. */
const steps = (page: Page): Locator =>
  page.getByRole("region", { name: "Etapas" }).filter({ visible: true });

/** A notice above the content, by its title. */
const notice = (page: Page, title: string): Locator =>
  page.locator('[data-slot="alert"]').filter({ hasText: title }).filter({ visible: true });

/** Nothing below the fold: the screen fits with its action (design guide, R10). */
async function expectNoScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
    .toBeLessThanOrEqual(0);
}

const proofOfAddress = {
  name: "fatura-agosto.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4"),
};

/** The three questions of the Figma request, answered up to the last one, not sent. */
async function answerQuestions(page: Page): Promise<void> {
  await page.goto("/producer/receiving/rfi");
  await field(page, "Proof of address type").selectOption("UTILITY_BILL");
  await page.locator('input[type="file"]').first().setInputFiles(proofOfAddress);
  await expect(visible(page, "fatura-agosto.pdf")).toBeVisible();
  await button(page, "Continuar").click();
  await expect(page).toHaveURL(/\/rfi\?passo=2$/);
  await field(page, "Source of funds description").fill("Venda de ingressos dos eventos");
  await button(page, "Continuar").click();
  await expect(page).toHaveURL(/\/rfi\?passo=3$/);
  await field(page, "Website").fill("https://casafluida.com.br");
}

test.describe("Resultados", () => {
  test("Em análise: the analysis, and the draft meanwhile", async ({ page }) => {
    await signIn(page, "verifying");
    await page.goto("/producer/receiving");

    await expect(visible(page, "Seus dados estão em análise")).toBeVisible();
    await expect(visible(page, /pode levar até 1 dia útil/)).toBeVisible();
    await expect(visible(page, "Enquanto isso, monte seu evento")).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar evento" })).toHaveAttribute(
      "href",
      "/producer/events/new",
    );
    await expect(steps(page)).toContainText("Enviados");
    await expect(steps(page)).toContainText("Em análise");
  });

  test("Em análise with the account that failed: its notice, and Tentar de novo signs it again", async ({
    page,
  }) => {
    await signIn(page, own("verifying-account-failed"));
    await page.goto("/producer/receiving");

    const account = notice(page, "Conta de recebimento");
    await expect(account).toContainText(
      "Não deu para preparar sua conta agora. As outras etapas seguem enquanto isso.",
    );
    await expect(visible(page, "Seus dados estão em análise")).toBeVisible();
    await expect(steps(page)).toContainText("Não deu para preparar");

    await account.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(account).toHaveCount(0);
    await expect(steps(page)).toContainText("Pronta");
  });

  test("Conta com erro during the configuration: the notice above the current step", async ({
    page,
  }) => {
    await signIn(page, own("setup-account-failed"));
    await page.goto("/producer/receiving");

    const account = notice(page, "Conta de recebimento");
    await expect(account).toBeVisible();
    await expect(steps(page)).toContainText("Não deu para preparar");
    if (isPhone(page)) {
      await expect(visible(page, "Etapa 2 de 5")).toBeVisible();
    } else {
      await expect(button(page, /Ler e aceitar os termos/)).toBeVisible();
    }
    await account.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(account).toHaveCount(0);
    await expect(steps(page)).toContainText("Pronta");
  });

  test("the resume of the account gives up after its tries, with the notice (R6)", async ({
    page,
  }) => {
    await page.clock.install();
    await signIn(page, own("account-stopped"));
    await page.goto("/producer/receiving");
    await expect(visible(page, "Seus dados estão em análise")).toBeVisible();
    await expect(steps(page)).toContainText("Preparando…");

    // The first try runs at once; two more, ten seconds apart, before the resume stops.
    const account = notice(page, "Conta de recebimento");
    await expect(async () => {
      await page.clock.fastForward(10_000);
      await expect(account).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
    await expect(steps(page)).toContainText("Não deu para preparar");

    await account.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(account).toHaveCount(0);
    await expect(steps(page)).toContainText("Pronta");
  });

  test("Recusado: BlindPay's reason, and the new attempt through the terms", async ({ page }) => {
    await signIn(page, own("rejected"));
    await page.goto("/producer/receiving");

    await expect(visible(page, "A verificação foi recusada")).toBeVisible();
    await expect(visible(page, "Detalhe informado pela BlindPay")).toBeVisible();
    await expect(
      visible(
        page,
        "The document image is blurry. Please upload a clearer photo of the front of the ID.",
      ),
    ).toBeVisible();
    await expect(steps(page)).toContainText("Recusada");

    await button(page, "Corrigir e enviar de novo").click();
    await expect(page).toHaveURL(/\/producer\/receiving\/terms$/);
    await expect(visible(page, /Cada verificação pede um novo aceite/)).toBeVisible();
  });

  test("Recusado with several reasons shows each one", async ({ page }) => {
    await signIn(page, "rejected-reasons");
    await page.goto("/producer/receiving");

    await expect(visible(page, /The document image is blurry/)).toBeVisible();
    await expect(
      visible(page, "The selfie does not match the photo on the document."),
    ).toBeVisible();
  });

  test("Recusado without a reason has no detail", async ({ page }) => {
    await signIn(page, "rejected-no-reason");
    await page.goto("/producer/receiving");

    await expect(visible(page, "A verificação foi recusada")).toBeVisible();
    await expect(button(page, "Corrigir e enviar de novo")).toBeVisible();
    await expect(page.getByText("Detalhe informado pela BlindPay")).toHaveCount(0);
  });

  test("Recusado whose reason failed to load still corrects and sends again", async ({ page }) => {
    await signIn(page, own("rejected-reason-failure-once"));
    await page.goto("/producer/receiving");

    const failure = notice(page, "Não deu para carregar o motivo");
    await expect(failure).toContainText("Você ainda pode corrigir e enviar de novo.");
    await expect(button(page, "Corrigir e enviar de novo")).toBeEnabled();
    await failure.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(visible(page, /The document image is blurry/)).toBeVisible();
    await expect(failure).toHaveCount(0);
  });

  test("Recusado whose reason never loads leads to the terms anyway", async ({ page }) => {
    await signIn(page, own("rejected-draft-failure"));
    await page.goto("/producer/receiving");

    await expect(notice(page, "Não deu para carregar o motivo")).toBeVisible();
    await button(page, "Corrigir e enviar de novo").click();
    await expect(page).toHaveURL(/\/producer\/receiving\/terms$/);
  });

  test("Liberando: the approved verification waits for BlindPay's wallet", async ({ page }) => {
    await signIn(page, own("releasing"));
    await page.goto("/producer/receiving");

    await expect(visible(page, "Verificação aprovada")).toBeVisible();
    await expect(visible(page, /ligando sua conta de recebimento à BlindPay/)).toBeVisible();
    await expect(steps(page)).toContainText("Liberando o recebimento…");
    await expect(page.getByRole("link", { name: "Criar evento" })).toHaveCount(0);
  });

  test("Liberando · Falha: Tentar de novo registers the wallet, and the producer is ready", async ({
    page,
  }) => {
    await signIn(page, own("releasing-failure"));
    await page.goto("/producer/receiving");

    const release = notice(page, "Não deu para liberar o recebimento");
    await expect(release).toContainText(
      "Sua verificação está aprovada. Tente de novo em instantes.",
    );
    await expect(visible(page, "Verificação aprovada")).toBeVisible();
    await release.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(visible(page, "Tudo pronto para vender")).toBeVisible();
    await expect(release).toHaveCount(0);
  });

  test("Aprovada · Conta a caminho: the account still on the network", async ({ page }) => {
    await signIn(page, own("account-on-way"));
    await page.goto("/producer/receiving");

    await expect(visible(page, "Verificação aprovada")).toBeVisible();
    await expect(
      visible(page, "Estamos terminando sua conta de recebimento. Leva alguns segundos."),
    ).toBeVisible();
    await expect(visible(page, "Preparando a conta de recebimento…")).toBeVisible();
    await expect(steps(page)).toContainText("Preparando…");
    await expect(steps(page)).toContainText("Aprovada");
  });

  test("Pronto: everything done, and Criar evento", async ({ page }) => {
    await signIn(page, "ready");
    await page.goto("/producer/receiving");

    await expect(visible(page, "Tudo pronto para vender")).toBeVisible();
    await expect(visible(page, /O dinheiro das vendas cai direto nela/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar evento" })).toHaveAttribute(
      "href",
      "/producer/events/new",
    );
    await expect(steps(page)).toContainText("Aprovada");
  });
});

test.describe("Pedido de informações", () => {
  test("the root has the deadline: Responder on the phone, the first question on the desktop", async ({
    page,
  }) => {
    await signIn(page, own("rfi"));
    await page.goto("/producer/receiving");

    await expect(steps(page)).toContainText("Responder até 3 nov");
    if (isPhone(page)) {
      await expect(visible(page, "A BlindPay pediu mais informações")).toBeVisible();
      await expect(
        visible(page, "Responda até 3 de novembro. Sem resposta, a verificação é recusada."),
      ).toBeVisible();
      await button(page, "Responder").click();
      await expect(page).toHaveURL(/\/producer\/receiving\/rfi$/);
      await expect(visible(page, "Etapa 5 de 5")).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/producer\/receiving$/);
      await expect(visible(page, /A mensagem abaixo é da equipe de verificação/)).toBeVisible();
    }
    await expect(visible(page, "Pergunta 1 de 3")).toBeVisible();
    await expect(visible(page, "Proof of address")).toBeVisible();
    await expect(
      visible(page, /doesn't match the address provided\. Please upload a new one\./),
    ).toBeVisible();
    await expectNoScroll(page);
  });

  test("one question per screen: checks each field, keeps the answers and sends them at once", async ({
    page,
  }) => {
    await signIn(page, own("rfi"));
    await page.goto("/producer/receiving/rfi");

    // Continuar with nothing: the list and the file are required.
    await button(page, "Continuar").click();
    await expect(page.getByText("Preencha este campo.").filter({ visible: true })).toHaveCount(2);
    await expect(page).toHaveURL(/\/rfi$/);
    await expectNoScroll(page);

    await field(page, "Proof of address type").selectOption("UTILITY_BILL");
    await page.locator('input[type="file"]').first().setInputFiles(proofOfAddress);
    await expect(visible(page, "fatura-agosto.pdf")).toBeVisible();
    await expect(page.getByText("Preencha este campo.").filter({ visible: true })).toHaveCount(0);
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/rfi\?passo=2$/);
    await expect(visible(page, "Pergunta 2 de 3")).toBeVisible();
    await expectNoScroll(page);
    await field(page, "Source of funds description").fill("Venda de ingressos dos eventos");
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/rfi\?passo=3$/);
    await expect(visible(page, "A resposta é enviada de uma vez só.")).toBeVisible();
    // The format of the request, checked when leaving the field.
    await field(page, "Website").fill("casafluida.com.br");
    await field(page, "Website").blur();
    await expect(visible(page, "Confira o formato pedido na mensagem acima.")).toBeVisible();
    await expectNoScroll(page);
    await field(page, "Website").fill("https://casafluida.com.br");
    await expect(page.getByText("Confira o formato pedido na mensagem acima.")).toHaveCount(0);

    // The browser's back goes one question at a time, with what was answered.
    await page.goBack();
    await expect(page).toHaveURL(/\/rfi\?passo=2$/);
    await expect(field(page, "Source of funds description")).toHaveValue(
      "Venda de ingressos dos eventos",
    );
    await page.goBack();
    await expect(field(page, "Proof of address type")).toHaveValue("UTILITY_BILL");
    await expect(visible(page, "fatura-agosto.pdf")).toBeVisible();
    await page.goForward();
    await page.goForward();
    await expect(field(page, "Website")).toHaveValue("https://casafluida.com.br");

    await button(page, "Enviar resposta").click();
    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(visible(page, "Resposta enviada")).toBeVisible();
    await expect(steps(page)).toContainText("Resposta enviada");
    // Answered: the questions lead back to the root.
    await page.goto("/producer/receiving/rfi");
    await expect(page).toHaveURL(/\/producer\/receiving$/);
  });

  test("a failure to send keeps the answers and sends the same answer again", async ({ page }) => {
    await signIn(page, own("rfi-submit-failure"));
    await answerQuestions(page);
    await button(page, "Enviar resposta").click();

    const failure = notice(page, "Não deu para enviar a resposta");
    await expect(failure).toContainText("Suas respostas continuam aqui.");
    await expect(field(page, "Website")).toHaveValue("https://casafluida.com.br");
    await expectNoScroll(page);
    // The simulated API takes the repeat only with the first Idempotency-Key.
    await failure.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(visible(page, "Resposta enviada")).toBeVisible();
  });

  test("a field the API refuses opens its question with the error", async ({ page }) => {
    await signIn(page, own("rfi-field-error"));
    await answerQuestions(page);
    await button(page, "Enviar resposta").click();

    await expect(page).toHaveURL(/\/rfi\?passo=2$/);
    await expect(visible(page, "Confira o formato pedido na mensagem acima.")).toBeVisible();
    await field(page, "Source of funds description").fill("Venda de ingressos de shows");
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/rfi\?passo=3$/);
    await button(page, "Enviar resposta").click();
    await expect(visible(page, "Resposta enviada")).toBeVisible();
  });

  test("an answer to a request that closed reads it again", async ({ page }) => {
    await signIn(page, own("rfi-gone"));
    await answerQuestions(page);
    await button(page, "Enviar resposta").click();

    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(visible(page, "O prazo para responder terminou")).toBeVisible();
  });

  test("Carregando: the request on its way", async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/producers/onboarding/rfi", async (route) => {
      await held;
      await route.continue();
    });
    await signIn(page, own("rfi"));
    await page.goto("/producer/receiving");

    await expect(steps(page)).toContainText("A BlindPay pediu informações");
    if (isPhone(page)) {
      await expect(button(page, "Responder")).toBeDisabled();
    } else {
      await expect(button(page, "Continuar")).toBeDisabled();
      await expect(visible(page, "Sem resposta, a verificação é recusada.")).toBeVisible();
      // The desktop's root is the first question, still a form that fits.
      await expectNoScroll(page);
    }
    release();
    await expect(steps(page)).toContainText("Responder até 3 nov");
  });

  test("Falha ao carregar: Tentar de novo reads the request again", async ({ page }) => {
    await signIn(page, own("rfi-load-failure"));
    await page.goto("/producer/receiving");

    const failure = notice(page, "Não deu para carregar o pedido");
    await expect(failure).toContainText("Confira sua conexão e tente de novo.");
    await expect(button(page, isPhone(page) ? "Responder" : "Continuar")).toBeDisabled();
    await failure.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(failure).toHaveCount(0);
    await expect(button(page, isPhone(page) ? "Responder" : "Continuar")).toBeEnabled();
  });

  test("Respondida: the answer in analysis", async ({ page }) => {
    await signIn(page, "rfi-submitted");
    await page.goto("/producer/receiving");

    await expect(visible(page, "Resposta enviada")).toBeVisible();
    await expect(visible(page, /A BlindPay analisa a sua resposta/)).toBeVisible();
    await expect(steps(page)).toContainText("Resposta enviada");
  });

  test("Prazo encerrado: the deadline passed without an answer", async ({ page }) => {
    await signIn(page, "rfi-expired");
    await page.goto("/producer/receiving");

    await expect(visible(page, "O prazo para responder terminou")).toBeVisible();
    await expect(visible(page, /vai concluir a verificação sem a resposta/)).toBeVisible();
    await expect(steps(page)).toContainText("Prazo encerrado");
  });

  test("a question not open yet leads to the first one, and no request to the root", async ({
    page,
  }) => {
    await signIn(page, own("rfi"));
    await page.goto("/producer/receiving/rfi?passo=3");
    await expect(page).toHaveURL(/\/producer\/receiving\/rfi$/);
    await expect(visible(page, "Pergunta 1 de 3")).toBeVisible();
  });

  test("without a request open, the questions lead to the root", async ({ page }) => {
    await signIn(page, "verifying");
    await page.goto("/producer/receiving/rfi");
    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(visible(page, "Seus dados estão em análise")).toBeVisible();
  });

  test("an approved producer with a request keeps selling meanwhile", async ({ page }) => {
    await signIn(page, own("approved-rfi"));
    await page.goto("/producer/receiving");

    await expect(visible(page, /As vendas continuam enquanto isso\./)).toBeVisible();
    await expect(page.getByText(/Sem resposta, a verificação é recusada/)).toHaveCount(0);
  });
});
