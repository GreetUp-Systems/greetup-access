import type { ProducerEvent, ProducerProfile } from "../api/producer";
import {
  chartLabelStep,
  dashboardNotice,
  dashboardView,
  peakDay,
  salesTrend,
  setupSteps,
} from "./dashboard";

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "compliance_pending",
  compliance: { status: null, hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});
const ready = producer({
  onboardingStatus: "ready",
  compliance: { status: "approved", hasOpenRfi: false },
});
const event = (status: ProducerEvent["status"]) => ({ status }) as ProducerEvent;

describe("dashboardView and dashboardNotice", () => {
  it("shows the setup until the producer can sell", () => {
    expect(dashboardView(producer(), [])).toBe("setup");
    expect(dashboardView(producer(), [event("draft")])).toBe("setup");
    expect(dashboardView(ready, [])).toBe("dashboard");
    expect(dashboardNotice(ready, [event("published")])).toBeNull();
  });

  it("keeps the numbers of a producer paused by a request, with its sales paused notice", () => {
    const paused = producer({ compliance: { status: "compliance_request", hasOpenRfi: true } });
    expect(dashboardView(paused, [event("published")])).toBe("dashboard");
    expect(dashboardNotice(paused, [event("published")])).toBe("paused");
    // Nothing published yet: still the setup, without the notice.
    expect(dashboardView(paused, [event("draft")])).toBe("setup");
    expect(dashboardNotice(paused, [event("draft")])).toBeNull();
  });

  it("warns about a request that lets the sales go on", () => {
    const rfi = producer({
      onboardingStatus: "ready",
      compliance: { status: "approved_rfi", hasOpenRfi: true },
    });
    expect(dashboardView(rfi, [])).toBe("dashboard");
    expect(dashboardNotice(rfi, [])).toBe("rfi");
    expect(
      dashboardNotice({ ...rfi, compliance: { status: "approved_rfi", hasOpenRfi: false } }, []),
    ).toBeNull();
  });
});

describe("salesTrend", () => {
  it("compares with the previous period, rounding to whole percent", () => {
    expect(salesTrend(182, 162)).toEqual({ direction: "positive", percent: 12 });
    expect(salesTrend(80, 100)).toEqual({ direction: "negative", percent: 20 });
    expect(salesTrend(100, 100)).toEqual({ direction: "neutral", percent: 0 });
  });

  it("has nothing to compare with when nothing sold before", () => {
    expect(salesTrend(50, 0)).toBeNull();
    expect(salesTrend(0, 0)).toBeNull();
  });
});

describe("the chart", () => {
  it("dates every day, week or three weeks", () => {
    expect([chartLabelStep("7d"), chartLabelStep("30d"), chartLabelStep("90d")]).toEqual([
      1, 7, 21,
    ]);
  });

  it("picks the best day, the latest on a tie, and none without sales", () => {
    const day = (salesCents: number) => ({ date: "2026-10-01", tickets: 0, salesCents });
    expect(peakDay([day(10), day(30), day(20)])).toBe(1);
    expect(peakDay([day(30), day(10), day(30)])).toBe(2);
    expect(peakDay([day(0), day(0)])).toBeNull();
  });
});

describe("setupSteps", () => {
  const states = (steps: ReturnType<typeof setupSteps>) =>
    steps.map((step) => `${step.state}:${step.detail}`);
  const none = { termsAccepted: false, rfiDeadline: null };

  it("starts with the account being prepared and the terms to accept", () => {
    expect(states(setupSteps(producer({ stellar: { status: "pending" } }), none))).toEqual([
      "in_progress:Preparando…",
      "current:Agora",
      "pending:Nome, CPF e endereço",
      "pending:Documento com foto e selfie",
      "pending:Costuma levar poucos minutos",
    ]);
  });

  it("moves to the data once the terms were accepted, as in Configuração pendente", () => {
    expect(states(setupSteps(producer(), { termsAccepted: true, rfiDeadline: null }))).toEqual([
      "done:Pronta",
      "done:Aceitos",
      "current:Nome, CPF e endereço",
      "pending:Documento com foto e selfie",
      "pending:Costuma levar poucos minutos",
    ]);
  });

  it("follows the verification once the data was sent", () => {
    const after = (compliance: ProducerProfile["compliance"], fields = {}) =>
      states(setupSteps(producer({ compliance, ...fields }), { ...none, rfiDeadline: "3 nov" }));
    expect(after({ status: "verifying", hasOpenRfi: false })).toEqual([
      "done:Pronta",
      "done:Aceitos",
      "done:Preenchidos",
      "done:Enviados",
      "in_progress:Em análise",
    ]);
    expect(after({ status: "compliance_request", hasOpenRfi: true })[4]).toBe(
      "current:Responder até 3 nov",
    );
    expect(after({ status: "rejected", hasOpenRfi: false })[4]).toBe("error:Recusada");
    expect(
      after(
        { status: "approved", hasOpenRfi: false },
        { onboardingStatus: "wallet_registration_pending" },
      )[4],
    ).toBe("in_progress:Liberando o recebimento…");
  });

  it("marks the account that could not be prepared", () => {
    expect(setupSteps(producer({ stellar: { status: "failed" } }), none)[0]).toEqual({
      key: "account",
      title: "Conta de recebimento",
      state: "error",
      detail: "Não deu para preparar",
    });
  });
});
