import type { ProducerProfile } from "../api/producer";
import {
  currentStep,
  documentFileTitle,
  documentsPassos,
  documentsPassosDone,
  parsePasso,
  type ReceivingProgress,
  type ReceivingStage,
  receivingStage,
  receivingSteps,
  resolveRoute,
  stepHref,
} from "./receiving-flow";

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "compliance_pending",
  compliance: { status: null, hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});

const kyc = (status: ProducerProfile["compliance"]["status"]): Partial<ProducerProfile> => ({
  compliance: { status, hasOpenRfi: false },
});

const progress = (overrides: Partial<ReceivingProgress> = {}): ReceivingProgress => ({
  termsAccepted: false,
  dataDone: 0,
  documentType: null,
  sent: { front: false, back: false, selfie: false },
  ...overrides,
});

const open: ReceivingStage = { open: true, retry: false, configuring: true };

describe("stepHref and parsePasso", () => {
  it("gives each step its address, with ?passo from the second passo", () => {
    expect(stepHref("terms")).toBe("/producer/receiving/terms");
    expect(stepHref("data")).toBe("/producer/receiving/data");
    expect(stepHref("data", 1)).toBe("/producer/receiving/data");
    expect(stepHref("data", 3)).toBe("/producer/receiving/data?passo=3");
    expect(stepHref("documents", 5)).toBe("/producer/receiving/documents?passo=5");
  });

  it("reads ?passo as a whole number from 1, and anything else as the first", () => {
    expect(parsePasso("2")).toBe(2);
    expect(parsePasso("05")).toBe(5);
    expect(parsePasso(null)).toBe(1);
    expect(parsePasso("0")).toBe(1);
    expect(parsePasso("-2")).toBe(1);
    expect(parsePasso("2.5")).toBe(1);
    expect(parsePasso("dois")).toBe(1);
    expect(parsePasso("999")).toBe(1);
  });
});

describe("receivingStage", () => {
  it("configures a producer that never sent the verification", () => {
    expect(receivingStage(producer(), { termsAccepted: false, submittedFrom: null })).toEqual({
      open: true,
      retry: false,
      configuring: true,
    });
  });

  it("shows the refusal until the terms are accepted again, then the new attempt (R2)", () => {
    const refused = producer(kyc("rejected"));
    expect(receivingStage(refused, { termsAccepted: false, submittedFrom: null })).toEqual({
      open: true,
      retry: true,
      configuring: false,
    });
    expect(receivingStage(refused, { termsAccepted: true, submittedFrom: null })).toEqual({
      open: true,
      retry: true,
      configuring: true,
    });
  });

  it("closes the steps once the verification is on its way or done", () => {
    for (const status of ["verifying", "approved", "compliance_request", "approved_rfi"] as const) {
      expect(
        receivingStage(producer(kyc(status)), { termsAccepted: true, submittedFrom: null }),
      ).toMatchObject({ open: false, configuring: false });
    }
  });

  it("is the result right after the submission, until the producer is read again", () => {
    const sent = { status: null };
    expect(receivingStage(producer(), { termsAccepted: false, submittedFrom: sent })).toEqual({
      open: false,
      retry: false,
      configuring: false,
    });
    // A new attempt sent: still "rejected" until the next read.
    expect(
      receivingStage(producer(kyc("rejected")), {
        termsAccepted: false,
        submittedFrom: { status: "rejected" },
      }),
    ).toMatchObject({ open: false, configuring: false });
  });
});

describe("currentStep", () => {
  it("is the terms, then Seus dados until its three passos are right, then Documentos", () => {
    expect(currentStep(progress())).toBe("terms");
    expect(currentStep(progress({ termsAccepted: true }))).toBe("data");
    expect(currentStep(progress({ termsAccepted: true, dataDone: 2 }))).toBe("data");
    expect(currentStep(progress({ termsAccepted: true, dataDone: 3 }))).toBe("documents");
  });
});

describe("documentsPassos", () => {
  it("has a back for RG and CNH, and none for the passport", () => {
    expect(documentsPassos("ID_CARD")).toEqual(["choose", "front", "back", "selfie", "review"]);
    expect(documentsPassos("DRIVERS")).toEqual(["choose", "front", "back", "selfie", "review"]);
    expect(documentsPassos("PASSPORT")).toEqual(["choose", "front", "selfie", "review"]);
    expect(documentsPassos(null)).toHaveLength(5);
  });

  it("counts the passos done in a row, never the review", () => {
    expect(documentsPassosDone(progress())).toBe(0);
    expect(documentsPassosDone(progress({ documentType: "ID_CARD" }))).toBe(1);
    expect(
      documentsPassosDone(
        progress({ documentType: "ID_CARD", sent: { front: true, back: false, selfie: true } }),
      ),
    ).toBe(2);
    expect(
      documentsPassosDone(
        progress({ documentType: "ID_CARD", sent: { front: true, back: true, selfie: true } }),
      ),
    ).toBe(4);
    expect(
      documentsPassosDone(
        progress({ documentType: "PASSPORT", sent: { front: true, back: false, selfie: true } }),
      ),
    ).toBe(3);
  });
});

describe("resolveRoute", () => {
  const filled = progress({ termsAccepted: true, dataDone: 3 });

  it("sends every step to the root once the verification was sent", () => {
    const closed: ReceivingStage = { open: false, retry: false, configuring: false };
    for (const step of ["terms", "data", "documents"] as const) {
      expect(resolveRoute(closed, filled, step, 1)).toEqual({
        kind: "redirect",
        href: "/producer/receiving",
      });
    }
  });

  it("keeps the terms open, even accepted, and the refused producer's new attempt starts there", () => {
    expect(resolveRoute(open, progress(), "terms", 1)).toEqual({
      kind: "show",
      step: "terms",
      passo: 1,
    });
    expect(resolveRoute(open, filled, "terms", 1)).toMatchObject({ kind: "show" });
    const refused: ReceivingStage = { open: true, retry: true, configuring: false };
    expect(resolveRoute(refused, progress(), "terms", 1)).toMatchObject({ kind: "show" });
    expect(resolveRoute(open, progress(), "terms", 2)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/terms",
    });
  });

  it("sends Seus dados and Documentos to the terms while they are not accepted", () => {
    expect(resolveRoute(open, progress(), "data", 1)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/terms",
    });
    expect(resolveRoute(open, progress(), "documents", 3)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/terms",
    });
  });

  it("opens a passo of Seus dados only after the ones before it", () => {
    const accepted = progress({ termsAccepted: true });
    expect(resolveRoute(open, accepted, "data", 1)).toMatchObject({ kind: "show", passo: 1 });
    expect(resolveRoute(open, accepted, "data", 3)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/data",
    });
    const two = progress({ termsAccepted: true, dataDone: 1 });
    expect(resolveRoute(open, two, "data", 2)).toMatchObject({ kind: "show", passo: 2 });
    expect(resolveRoute(open, two, "data", 3)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/data?passo=2",
    });
    // Going back to an earlier passo is always open.
    expect(resolveRoute(open, filled, "data", 1)).toMatchObject({ kind: "show", passo: 1 });
    expect(resolveRoute(open, filled, "data", 7)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/data?passo=3",
    });
  });

  it("sends Documentos to the first pending passo of Seus dados", () => {
    expect(
      resolveRoute(open, progress({ termsAccepted: true, dataDone: 2 }), "documents", 1),
    ).toEqual({ kind: "redirect", href: "/producer/receiving/data?passo=3" });
  });

  it("opens a passo of Documentos only after the ones before it", () => {
    expect(resolveRoute(open, filled, "documents", 1)).toMatchObject({ kind: "show", passo: 1 });
    expect(resolveRoute(open, filled, "documents", 2)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/documents",
    });
    const front = { ...filled, documentType: "ID_CARD" as const };
    expect(resolveRoute(open, front, "documents", 2)).toMatchObject({ kind: "show", passo: 2 });
    expect(resolveRoute(open, front, "documents", 5)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/documents?passo=2",
    });
    const all = { ...front, sent: { front: true, back: true, selfie: true } };
    expect(resolveRoute(open, all, "documents", 5)).toMatchObject({ kind: "show", passo: 5 });
  });

  it("gives the passport four passos: past the review leads back to it", () => {
    const passport = {
      ...filled,
      documentType: "PASSPORT" as const,
      sent: { front: true, back: false, selfie: true },
    };
    expect(resolveRoute(open, passport, "documents", 4)).toMatchObject({ kind: "show", passo: 4 });
    expect(resolveRoute(open, passport, "documents", 5)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/documents?passo=4",
    });
  });
});

describe("receivingSteps", () => {
  const summary = (items: ReturnType<typeof receivingSteps>) =>
    items.map((item) => `${item.state}:${item.title}:${item.detail}`);

  it("lists the first attempt at the terms (501:5529), the account on its way", () => {
    expect(
      summary(
        receivingSteps(producer({ stellar: { status: "signing" } }), progress(), {
          shown: "terms",
          detail: "Agora",
          retry: false,
        }),
      ),
    ).toEqual([
      "in_progress:Conta de recebimento:Preparando…",
      "current:Termos da BlindPay:Agora",
      "pending:Seus dados:Nome, CPF e endereço",
      "pending:Documentos:Documento com foto e selfie",
      "pending:Verificação:Depois do envio",
    ]);
  });

  it("marks the steps before the one on the screen as done, with the passo on the desktop", () => {
    expect(
      summary(
        receivingSteps(producer(), progress({ termsAccepted: true, dataDone: 3 }), {
          shown: "documents",
          detail: "2 de 5",
          retry: false,
        }),
      ),
    ).toEqual([
      "done:Conta de recebimento:Pronta",
      "done:Termos da BlindPay:Aceitos",
      "done:Seus dados:Preenchidos",
      "current:Documentos:2 de 5",
      "pending:Verificação:Depois do envio",
    ]);
  });

  it("says what a new attempt brings back and sends again (499:4710, 550:15627)", () => {
    expect(
      summary(
        receivingSteps(producer(kyc("rejected")), progress(), {
          shown: "terms",
          detail: "Agora",
          retry: true,
        }),
      ),
    ).toEqual([
      "done:Conta de recebimento:Pronta",
      "current:Termos da BlindPay:Agora",
      "pending:Seus dados:Preenchidos da última vez",
      "pending:Documentos:Enviar de novo",
      "pending:Verificação:Nova verificação",
    ]);
  });

  it("shows the account that could not be prepared as an error", () => {
    const [account] = receivingSteps(producer({ stellar: { status: "failed" } }), progress(), {
      shown: "terms",
      detail: "Agora",
      retry: false,
    });
    expect(account).toEqual({
      key: "account",
      title: "Conta de recebimento",
      state: "error",
      detail: "Não deu para preparar",
    });
  });
});

describe("documentFileTitle", () => {
  it("names each file of each document", () => {
    expect(documentFileTitle("ID_CARD", "front")).toBe("Frente do RG");
    expect(documentFileTitle("ID_CARD", "back")).toBe("Verso do RG");
    expect(documentFileTitle("DRIVERS", "front")).toBe("Frente da CNH");
    expect(documentFileTitle("DRIVERS", "back")).toBe("Verso da CNH");
    expect(documentFileTitle("PASSPORT", "front")).toBe("Página com a foto");
    expect(documentFileTitle("PASSPORT", "selfie")).toBe("Selfie");
  });
});
