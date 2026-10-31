import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

// Criar perfil and the Recebimento's configuration of SPEC-015 15C, signed in through the test
// session as the producer of a scenario of the simulated API (e2e/mock-api.mjs). ViaCEP and
// BlindPay's page of the terms are answered here, in the browser.
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

/** A field by its exact label ("Telefone", not the form "Seu telefone"). */
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

// ViaCEP from the browser: 01310-100 is found; any other CEP is not (`erro`, as ViaCEP answers).
async function answerViaCep(page: Page): Promise<void> {
  await page.route("https://viacep.com.br/ws/**", (route) => {
    const found = route.request().url().includes("/ws/01310100/");
    return route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      json: found
        ? {
            cep: "01310-100",
            logradouro: "Avenida Paulista",
            bairro: "Bela Vista",
            localidade: "São Paulo",
            uf: "SP",
          }
        : { erro: "true" },
    });
  });
}

// BlindPay's page of the terms: accepting goes back to the Recebimento with `tos_id`.
async function answerBlindPayTerms(page: Page): Promise<void> {
  await page.route("https://blindpay.e2e/**", (route) => {
    const redirect = new URL(route.request().url()).searchParams.get("redirect") ?? "";
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><body>
        <a href="${redirect}?tos_id=to_e2e_aceite">Aceitar os termos</a>
        <a href="${redirect}">Voltar sem aceitar</a>
      </body></html>`,
    });
  });
}

/** Nothing below the fold: the form fits the screen with its action (design guide, R10). */
async function expectNoScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
    .toBeLessThanOrEqual(0);
}

const photo = (name: string) => ({ name, mimeType: "image/jpeg", buffer: Buffer.from(`${name}`) });

async function chooseFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(file);
}

/** Back from BlindPay with the terms accepted: Seus dados, passo 1. */
async function acceptTerms(page: Page): Promise<void> {
  await page.goto("/producer/receiving/data?tos_id=to_e2e_aceite");
  await expect(visible(page, "Quem é você")).toBeVisible();
  await expect(page).toHaveURL(/\/producer\/receiving\/data$/);
}

async function fillWho(page: Page): Promise<void> {
  await field(page, "Nome").fill("Ana");
  await field(page, "Sobrenome").fill("Souza");
  await field(page, "CPF").fill("12345678909");
  await field(page, "Data de nascimento").fill("15031990");
}

/** The three passos of Seus dados, with the CEP found, up to Documentos. */
async function fillData(page: Page): Promise<void> {
  await acceptTerms(page);
  await fillWho(page);
  await button(page, "Continuar").click();
  await field(page, "Telefone").fill("11912345678");
  await button(page, "Continuar").click();
  await field(page, "CEP").fill("01310100");
  await expect(field(page, "Rua")).toHaveValue("Avenida Paulista");
  await field(page, "Número").fill("1200");
  await button(page, "Continuar").click();
  await expect(visible(page, "Qual documento você vai usar?")).toBeVisible();
}

/** RG front, back and selfie, up to Confira e envie; each file once its passo is on screen. */
async function sendRg(page: Page): Promise<void> {
  await page.getByText("RG", { exact: true }).click();
  await button(page, "Continuar").click();
  await expect(visible(page, "Documentos · 2 de 5")).toBeVisible();
  await chooseFile(page, photo("rg-frente.jpg"));
  await expect(visible(page, "rg-frente.jpg")).toBeVisible();
  await button(page, "Continuar").click();
  await expect(visible(page, "Documentos · 3 de 5")).toBeVisible();
  await chooseFile(page, photo("rg-verso.jpg"));
  await expect(visible(page, "rg-verso.jpg")).toBeVisible();
  await button(page, "Continuar").click();
  await expect(visible(page, "Documentos · 4 de 5")).toBeVisible();
  await chooseFile(page, photo("selfie.jpg"));
  await expect(visible(page, "selfie.jpg")).toBeVisible();
  await button(page, "Continuar").click();
  await expect(visible(page, "Confira e envie")).toBeVisible();
}

test.describe("Criar perfil", () => {
  test("an account without a profile creates it and lands on the Recebimento", async ({ page }) => {
    await signIn(page, own("new-producer"));
    await page.goto("/producer/events");
    await expect(page).toHaveURL(/\/producer\/start$/);
    await expect(visible(page, "Crie seu perfil de produtor")).toBeVisible();

    // Nome vazio: the field says what to write.
    await button(page, "Criar perfil").click();
    await expect(visible(page, "Escreva o nome que vai aparecer para quem compra.")).toBeVisible();
    await expectNoScroll(page);

    await field(page, "Nome do produtor").fill("Casa Fluida");
    await expect(
      visible(page, "Aparece como “Organizado por Casa Fluida” na página de cada evento."),
    ).toBeVisible();
    await button(page, "Criar perfil").click();

    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(visible(page, "Termos da BlindPay")).toBeVisible();
    // The receiving account, started by Criar perfil and signed with the test's wallet.
    await expect(visible(page, "Pronta")).toBeVisible();
    if (isPhone(page)) {
      await expect(visible(page, "Etapa 2 de 5")).toBeVisible();
      await expect(page.getByRole("link", { name: "Continuar" })).toHaveAttribute(
        "href",
        "/producer/receiving/terms",
      );
    } else {
      await expect(button(page, /Ler e aceitar os termos/)).toBeVisible();
    }
  });

  test("offers to try again when the profile could not be created", async ({ page }) => {
    await signIn(page, own("new-producer-failure"));
    await page.goto("/producer/start");
    await field(page, "Nome do produtor").fill("Casa Fluida");
    await button(page, "Criar perfil").click();

    await expect(visible(page, "Não deu para criar o perfil")).toBeVisible();
    await expectNoScroll(page);
    await button(page, "Tentar de novo").click();
    await expect(page).toHaveURL(/\/producer\/receiving$/);
  });

  test("an account that already has a profile goes to the Painel", async ({ page }) => {
    await signIn(page, "ready");
    await page.goto("/producer/start");
    await expect(page).toHaveURL(/\/producer$/);
  });

  test("has its exit: the site on the desktop, back on the phone", async ({ page }) => {
    await signIn(page, own("new-producer"));
    await page.goto("/producer/start");
    if (isPhone(page)) {
      await expect(visible(page, "Vender ingressos")).toBeVisible();
      await expect(button(page, "Voltar")).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: "Voltar ao site" })).toHaveAttribute("href", "/");
    }
  });
});

test.describe("Termos", () => {
  test("accepted on BlindPay's page, they come back to Seus dados", async ({ page }) => {
    await answerBlindPayTerms(page);
    await signIn(page, own("setup"));
    await page.goto("/producer/receiving");
    if (isPhone(page)) {
      await page.getByRole("link", { name: "Continuar" }).click();
      await expect(page).toHaveURL(/\/producer\/receiving\/terms$/);
    }
    await expectNoScroll(page);
    await button(page, /Ler e aceitar os termos/).click();
    await page.getByRole("link", { name: "Aceitar os termos" }).click();

    // The acceptance is kept and taken out of the address.
    await expect(page).toHaveURL(/\/producer\/receiving\/data$/);
    await expect(visible(page, "Quem é você")).toBeVisible();
    if (!isPhone(page)) {
      await expect(visible(page, "Aceitos")).toBeVisible();
    }
  });

  test("coming back without the acceptance says so on the terms", async ({ page }) => {
    await answerBlindPayTerms(page);
    await signIn(page, own("setup"));
    await page.goto("/producer/receiving/terms");
    await button(page, /Ler e aceitar os termos/).click();
    await page.getByRole("link", { name: "Voltar sem aceitar" }).click();

    await expect(page).toHaveURL(/\/producer\/receiving\/terms$/);
    await expect(visible(page, "Os termos não foram aceitos")).toBeVisible();
    await expectNoScroll(page);
  });

  test("a failure to open them offers to try again", async ({ page }) => {
    await answerBlindPayTerms(page);
    await signIn(page, own("setup-terms-failure"));
    await page.goto("/producer/receiving/terms");
    await button(page, /Ler e aceitar os termos/).click();

    await expect(visible(page, "Não deu para abrir os termos")).toBeVisible();
    await expectNoScroll(page);
    await button(page, "Tentar de novo").click();
    await expect(page.getByRole("link", { name: "Aceitar os termos" })).toBeVisible();
  });

  test("Seus dados and Documentos wait for the acceptance", async ({ page }) => {
    await signIn(page, own("setup"));
    await page.goto("/producer/receiving/documents?passo=3");
    await expect(page).toHaveURL(/\/producer\/receiving\/terms$/);
  });
});

test.describe("Seus dados", () => {
  test("goes passo by passo, checks the fields and keeps them going back", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup"));
    await acceptTerms(page);
    await expectNoScroll(page);

    // Continuar with the fields empty, then a CPF that is not one.
    await button(page, "Continuar").click();
    await expect(page.getByText("Preencha este campo.").filter({ visible: true })).toHaveCount(4);
    await expectNoScroll(page);
    await fillWho(page);
    await field(page, "CPF").fill("12345678900");
    await field(page, "Data de nascimento").focus();
    await expect(visible(page, "CPF inválido. Confira os números.")).toBeVisible();
    await field(page, "CPF").fill("12345678909");
    await expect(field(page, "CPF")).toHaveValue("123.456.789-09");
    await expect(page.getByText("CPF inválido. Confira os números.")).toHaveCount(0);
    await expectNoScroll(page);
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/data\?passo=2$/);
    await expect(visible(page, "Seu telefone")).toBeVisible();
    await expect(visible(page, /voce@email\.com/)).toBeVisible();
    await field(page, "Telefone").fill("11912345678");
    await expect(field(page, "Telefone")).toHaveValue("(11) 91234-5678");
    await expectNoScroll(page);
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/data\?passo=3$/);
    await expect(button(page, "Continuar")).toBeDisabled();
    await field(page, "CEP").fill("01310100");
    await expect(field(page, "Rua")).toHaveValue("Avenida Paulista");
    await expect(field(page, "Cidade")).toHaveValue("São Paulo");
    await expect(field(page, "Estado")).toHaveValue("SP");
    await field(page, "Número").fill("1200");
    await field(page, "Complemento").fill("Apto 42");
    await expectNoScroll(page);
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/producer\/receiving\/documents$/);

    // The browser's back goes one passo at a time, with everything typed.
    await page.goBack();
    await expect(page).toHaveURL(/\/data\?passo=3$/);
    await expect(field(page, "Número")).toHaveValue("1200");
    await expect(field(page, "Rua")).toHaveValue("Avenida Paulista");
    await page.goBack();
    await expect(field(page, "Telefone")).toHaveValue("(11) 91234-5678");
    await page.goBack();
    await expect(field(page, "Nome")).toHaveValue("Ana");
    await expect(field(page, "Data de nascimento")).toHaveValue("15/03/1990");
  });

  test("a CEP not found opens the address to be filled by hand", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup"));
    await acceptTerms(page);
    await fillWho(page);
    await button(page, "Continuar").click();
    await field(page, "Telefone").fill("11912345678");
    await button(page, "Continuar").click();

    await field(page, "CEP").fill("01319100");
    await expect(
      visible(page, "Não achamos esse CEP. Confira ou preencha o endereço."),
    ).toBeVisible();
    await expect(field(page, "Rua")).toHaveValue("");
    await expect(button(page, "Continuar")).toBeDisabled();
    await expectNoScroll(page);

    await field(page, "Rua").fill("Rua Nova");
    await field(page, "Número").fill("10");
    await field(page, "Cidade").fill("São Paulo");
    await field(page, "Estado").selectOption("SP");
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/producer\/receiving\/documents$/);
  });

  test("a reload without the data in memory starts Seus dados over", async ({ page }) => {
    await signIn(page, own("setup"));
    await acceptTerms(page);
    await fillWho(page);
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/data\?passo=2$/);
    await page.reload();
    await expect(page).toHaveURL(/\/producer\/receiving\/data$/);
    await expect(field(page, "Nome")).toHaveValue("");
  });

  test("a new attempt brings the refused attempt's data back (R2)", async ({ page }) => {
    await signIn(page, own("rejected"));
    await page.goto("/producer/receiving/terms");
    await expect(visible(page, /Cada verificação pede um novo aceite/)).toBeVisible();

    await acceptTerms(page);
    await expect(visible(page, "Seus dados da última vez")).toBeVisible();
    await expect(field(page, "Nome")).toHaveValue("Ana");
    await expect(field(page, "CPF")).toHaveValue("123.456.789-09");
    await expectNoScroll(page);

    // Filled is not done: the new attempt goes through Seus dados again, from the root too.
    if (isPhone(page)) {
      await button(page, "Voltar").click();
      await expect(visible(page, "Etapa 3 de 5")).toBeVisible();
      await expect(visible(page, "Enviar de novo")).toBeVisible();
    } else {
      await page
        .getByRole("navigation", { name: "Navegação" })
        .getByRole("link", { name: "Recebimento" })
        .click();
      await expect(page).toHaveURL(/\/producer\/receiving$/);
      await expect(visible(page, "Seus dados · 1 de 3")).toBeVisible();
    }
  });

  test("a new attempt whose data could not be read starts empty, and says so", async ({ page }) => {
    await signIn(page, own("rejected-draft-failure"));
    await acceptTerms(page);
    await expect(visible(page, "Não deu para trazer seus dados da última vez")).toBeVisible();
    await expect(field(page, "Nome")).toHaveValue("");
    await expect(field(page, "Nome")).toBeEnabled();
    await expectNoScroll(page);
  });
});

test.describe("Documentos", () => {
  test("one screen per item, with the files' errors, up to the review", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup"));
    await fillData(page);
    await expect(button(page, "Continuar")).toBeDisabled();
    await expectNoScroll(page);

    await page.getByText("RG", { exact: true }).click();
    await button(page, "Continuar").click();
    await expect(page).toHaveURL(/\/documents\?passo=2$/);
    await expect(visible(page, "Documentos · 2 de 5")).toBeVisible();

    // A type outside the list, then BlindPay's refusal: each says what to do.
    await chooseFile(page, {
      name: "documento.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(visible(page, "O documento precisa ser PDF, JPG ou PNG.")).toBeVisible();
    await chooseFile(page, photo("rg-frente-recusado.jpg"));
    await expect(
      visible(page, "A BlindPay não aceitou este arquivo. Escolha outro."),
    ).toBeVisible();
    await expect(button(page, "Continuar")).toBeDisabled();
    await expectNoScroll(page);
    await chooseFile(page, photo("rg-frente.jpg"));
    await expect(visible(page, "rg-frente.jpg")).toBeVisible();
    await button(page, "Continuar").click();

    await expect(visible(page, "Verso do RG")).toBeVisible();
    await chooseFile(page, photo("rg-verso.jpg"));
    await expect(visible(page, "rg-verso.jpg")).toBeVisible();
    await button(page, "Continuar").click();

    await expect(visible(page, "Documentos · 4 de 5")).toBeVisible();
    await chooseFile(page, {
      name: "selfie.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    });
    await expect(visible(page, "A selfie precisa ser uma foto em JPG ou PNG.")).toBeVisible();
    await chooseFile(page, photo("selfie.jpg"));
    await expect(visible(page, "selfie.jpg")).toBeVisible();
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/documents\?passo=5$/);
    await expect(visible(page, "Confira e envie")).toBeVisible();
    for (const name of ["rg-frente.jpg", "rg-verso.jpg", "selfie.jpg"]) {
      await expect(visible(page, name)).toBeVisible();
    }
    await expectNoScroll(page);
  });

  test("the passport skips the back", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup"));
    await fillData(page);

    await page.getByText("Passaporte brasileiro").click();
    await button(page, "Continuar").click();
    await expect(visible(page, "Documentos · 2 de 4")).toBeVisible();
    await expect(visible(page, "Página com a foto").first()).toBeVisible();
    await chooseFile(page, photo("passaporte.jpg"));
    await expect(visible(page, "passaporte.jpg")).toBeVisible();
    await button(page, "Continuar").click();

    await expect(visible(page, "Documentos · 3 de 4")).toBeVisible();
    await chooseFile(page, photo("selfie.jpg"));
    await expect(visible(page, "selfie.jpg")).toBeVisible();
    await button(page, "Continuar").click();

    await expect(page).toHaveURL(/\/documents\?passo=4$/);
    await expect(visible(page, "Documentos · 4 de 4")).toBeVisible();
    await expect(visible(page, "Verso do RG")).toBeHidden();
    await expect(page.locator('[data-slot="file-field"]').filter({ visible: true })).toHaveCount(2);
  });
});

test.describe("Enviar para verificação", () => {
  test("an earlier submission still in progress (409)", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup-busy"));
    await fillData(page);
    await sendRg(page);
    await button(page, "Enviar para verificação").click();

    await expect(visible(page, "Seu envio anterior ainda está em processamento")).toBeVisible();
    await expect(page).toHaveURL(/\/documents\?passo=5$/);
    await expectNoScroll(page);
  });

  test("BlindPay's refusal (422) leads back to Seus dados, filled", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup-refused"));
    await fillData(page);
    await sendRg(page);
    await button(page, "Enviar para verificação").click();

    await expect(visible(page, "A BlindPay não aceitou o envio")).toBeVisible();
    await expectNoScroll(page);
    await button(page, "Revisar dados").click();
    await expect(page).toHaveURL(/\/producer\/receiving\/data$/);
    await expect(field(page, "Nome")).toHaveValue("Ana");
  });

  test("a failure (503) is tried again with the same request, then the root", async ({ page }) => {
    await answerViaCep(page);
    await signIn(page, own("setup-failure"));
    await fillData(page);
    await sendRg(page);
    await button(page, "Enviar para verificação").click();

    await expect(visible(page, "Não deu para enviar para verificação")).toBeVisible();
    await expectNoScroll(page);
    // The simulated API takes the repeat only with the first Idempotency-Key.
    await button(page, "Tentar de novo").click();
    await expect(page).toHaveURL(/\/producer\/receiving$/);
    await expect(page.getByText("Etapa 4 de 5")).toHaveCount(0);
    // After the submission the steps lead back to the root.
    await page.goto("/producer/receiving/documents?passo=5");
    await expect(page).toHaveURL(/\/producer\/receiving$/);
  });
});
