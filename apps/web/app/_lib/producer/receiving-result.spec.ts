import type { OpenRfi } from "../api/onboarding";
import type { ProducerProfile } from "../api/producer";
import {
  accountNotice,
  type ReceivingResult,
  receivingResult,
  resultSteps,
  rfiConsequence,
  rfiOpen,
  type RfiRead,
} from "./receiving-result";

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "compliance_pending",
  compliance: { status: "verifying", hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});

const kyc = (
  status: ProducerProfile["compliance"]["status"],
  fields: Partial<ProducerProfile> = {},
): ProducerProfile =>
  producer({
    compliance: {
      status,
      hasOpenRfi: status === "compliance_request" || status === "approved_rfi",
    },
    ...fields,
  });

const request = (status: OpenRfi["status"], id = "rfi_1"): OpenRfi => ({
  id,
  status,
  request: [],
  expiresAt: "2026-11-03T15:00:00.000Z",
  createdAt: "2026-10-07T15:00:00.000Z",
});

const loaded = (rfi: OpenRfi | null, answeredId: string | null = null): RfiRead => ({
  status: "loaded",
  rfi,
  answeredId,
});
const notRead: RfiRead = { status: "loading", rfi: null, answeredId: null };
const result = (p: ProducerProfile, rfi: RfiRead = notRead, open = true): ReceivingResult =>
  receivingResult(p, { open, rfi });

describe("rfiOpen", () => {
  it("is a paused verification, or an approved one with a request open", () => {
    expect(rfiOpen(kyc("compliance_request"))).toBe(true);
    expect(rfiOpen(kyc("approved_rfi"))).toBe(true);
    expect(rfiOpen(producer({ compliance: { status: "approved_rfi", hasOpenRfi: false } }))).toBe(
      false,
    );
    expect(rfiOpen(kyc("verifying"))).toBe(false);
    expect(rfiOpen(kyc("approved"))).toBe(false);
  });
});

describe("receivingResult", () => {
  it("follows the table of SPEC-015 §6", () => {
    expect(result(kyc("verifying"))).toBe("in_review");
    expect(result(kyc("rejected"))).toBe("rejected");
    expect(result(kyc("approved", { onboardingStatus: "ready" }))).toBe("ready");
    expect(result(kyc("approved", { onboardingStatus: "wallet_registration_pending" }))).toBe(
      "releasing",
    );
    expect(
      result(
        kyc("approved", { onboardingStatus: "stellar_pending", stellar: { status: "submitted" } }),
      ),
    ).toBe("account_on_way");
    // An account that failed after the approval: the notice says so above Conta a caminho.
    expect(
      result(
        kyc("approved", { onboardingStatus: "stellar_pending", stellar: { status: "failed" } }),
      ),
    ).toBe("account_on_way");
  });

  it("shows what this page just sent as in analysis until the producer is read again", () => {
    expect(result(kyc(null), notRead, false)).toBe("in_review");
    expect(result(kyc("rejected"), notRead, false)).toBe("in_review");
  });

  it("lets the request's status decide while one is open", () => {
    const paused = kyc("compliance_request");
    expect(result(paused, notRead)).toBe("rfi");
    expect(result(paused, { status: "failed", rfi: null, answeredId: null })).toBe("rfi");
    expect(result(paused, loaded(request("pending")))).toBe("rfi");
    expect(result(paused, loaded(request("submitted")))).toBe("rfi_answered");
    expect(result(paused, loaded(request("expired")))).toBe("rfi_expired");
    expect(result(paused, loaded(request("cancelled")))).toBe("in_review");
    expect(result(paused, loaded(null))).toBe("in_review");
  });

  it("keeps an approved producer whose request closed in its own result", () => {
    const approved = kyc("approved_rfi", { onboardingStatus: "ready" });
    expect(result(approved, loaded(request("pending")))).toBe("rfi");
    expect(result(approved, loaded(null))).toBe("ready");
    expect(result(approved, loaded(request("cancelled")))).toBe("ready");
  });

  it("shows the request answered here as Respondida, until another one opens", () => {
    const paused = kyc("compliance_request");
    expect(result(paused, loaded(request("pending"), "rfi_1"))).toBe("rfi_answered");
    expect(result(paused, loaded(null, "rfi_1"))).toBe("rfi_answered");
    expect(result(paused, { status: "loading", rfi: null, answeredId: "rfi_1" })).toBe(
      "rfi_answered",
    );
    expect(result(paused, loaded(request("pending", "rfi_2"), "rfi_1"))).toBe("rfi");
    // BlindPay moved the verification on: the answer is behind.
    expect(result(kyc("verifying"), loaded(null, "rfi_1"))).toBe("in_review");
  });
});

describe("accountNotice", () => {
  it("is the receiving account's when it failed or its resume gave up preparing it", () => {
    expect(accountNotice(producer({ stellar: { status: "failed" } }), { stopped: false })).toBe(
      "account",
    );
    expect(accountNotice(producer({ stellar: { status: "pending" } }), { stopped: true })).toBe(
      "account",
    );
    expect(accountNotice(producer({ stellar: { status: "pending" } }), { stopped: false })).toBe(
      null,
    );
  });

  it("is Liberando · Falha when the resume gave up registering BlindPay's wallet", () => {
    const releasing = kyc("approved", { onboardingStatus: "wallet_registration_pending" });
    expect(accountNotice(releasing, { stopped: true })).toBe("release");
    expect(accountNotice(releasing, { stopped: false })).toBeNull();
  });
});

describe("resultSteps", () => {
  const steps = (p: ProducerProfile, r: ReceivingResult, deadline: string | null = null) =>
    resultSteps(p, {
      result: r,
      rfiDeadline: deadline,
      notice: accountNotice(p, { stopped: false }),
    }).map((step) => `${step.state}:${step.detail}`);

  it("has everything sent, and the verification as the result says (§5.2)", () => {
    expect(steps(kyc("verifying"), "in_review")).toEqual([
      "done:Pronta",
      "done:Aceitos",
      "done:Preenchidos",
      "done:Enviados",
      "in_progress:Em análise",
    ]);
    const last = (p: ProducerProfile, r: ReceivingResult, deadline: string | null = null) =>
      steps(p, r, deadline)[4];
    expect(last(kyc("compliance_request"), "rfi", "3 nov")).toBe("current:Responder até 3 nov");
    expect(last(kyc("compliance_request"), "rfi")).toBe("current:A BlindPay pediu informações");
    expect(last(kyc("compliance_request"), "rfi_answered")).toBe("in_progress:Resposta enviada");
    expect(last(kyc("compliance_request"), "rfi_expired")).toBe("in_progress:Prazo encerrado");
    expect(last(kyc("rejected"), "rejected")).toBe("error:Recusada");
    expect(last(kyc("approved"), "releasing")).toBe("in_progress:Liberando o recebimento…");
    expect(last(kyc("approved"), "account_on_way")).toBe("done:Aprovada");
    expect(last(kyc("approved"), "ready")).toBe("done:Aprovada");
  });

  it("shows the account on its way, and as an error under its notice", () => {
    expect(steps(producer({ stellar: { status: "submitted" } }), "account_on_way")[0]).toBe(
      "in_progress:Preparando…",
    );
    expect(steps(producer({ stellar: { status: "failed" } }), "in_review")[0]).toBe(
      "error:Não deu para preparar",
    );
    const stopped = resultSteps(producer({ stellar: { status: "pending" } }), {
      result: "in_review",
      rfiDeadline: null,
      notice: "account",
    });
    expect(stopped[0]?.detail).toBe("Não deu para preparar");
    // Liberando · Falha: the account is ready; the wallet is what failed.
    const release = resultSteps(
      kyc("approved", { onboardingStatus: "wallet_registration_pending" }),
      {
        result: "releasing",
        rfiDeadline: null,
        notice: "release",
      },
    );
    expect(release[0]?.detail).toBe("Pronta");
  });
});

describe("rfiConsequence", () => {
  it("warns a paused producer of the refusal, and tells an approved one the sales go on", () => {
    expect(rfiConsequence(kyc("compliance_request"))).toBe(
      "Sem resposta, a verificação é recusada.",
    );
    expect(rfiConsequence(kyc("approved_rfi"))).toBe("As vendas continuam enquanto isso.");
  });
});
