import type { ProducerEvent, ProducerProfile, SalesPeriod, SalesSummary } from "../api/producer";

/**
 * The Painel's two shapes (SPEC-015 §6): before the producer can sell, the setup in steps; then the
 * numbers. A producer paused by a request for information keeps the numbers once it has published.
 */
export function dashboardView(
  producer: ProducerProfile,
  events: readonly ProducerEvent[],
): "setup" | "dashboard" {
  if (producer.onboardingStatus === "ready") {
    return "dashboard";
  }
  const paused = producer.compliance.status === "compliance_request";
  return paused && events.some((event) => event.status === "published") ? "dashboard" : "setup";
}

/**
 * The notice at the top (P7): sales paused by a request for information, when something is
 * published; or a request that lets the sales go on (approved_rfi). The first visit after the
 * approval is the screen's, since it is remembered in the browser.
 */
export function dashboardNotice(
  producer: ProducerProfile,
  events: readonly ProducerEvent[],
): "paused" | "rfi" | null {
  const { status, hasOpenRfi } = producer.compliance;
  if (status === "compliance_request" && events.some((event) => event.status === "published")) {
    return "paused";
  }
  return status === "approved_rfi" && hasOpenRfi ? "rfi" : null;
}

export interface Trend {
  direction: "positive" | "negative" | "neutral";
  /** Whole percent, without the sign. */
  percent: number;
}

/** Against the previous period of the same length; none when nothing sold in it. */
export function salesTrend(current: number, previous: number): Trend | null {
  if (previous === 0) {
    return null;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    direction: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
    percent: Math.abs(change),
  };
}

export const salesPeriods: readonly SalesPeriod[] = ["7d", "30d", "90d"];
export const periodDays: Record<SalesPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** The chart dates every day of a week, every week of a month, every three weeks of 90 days. */
export function chartLabelStep(period: SalesPeriod): number {
  return { "7d": 1, "30d": 7, "90d": 21 }[period];
}

/** The day the chart picks when nothing is pointed: the best one, the latest on a tie. */
export function peakDay(daily: SalesSummary["daily"]): number | null {
  let best: number | null = null;
  daily.forEach((day, index) => {
    if (day.salesCents > 0 && (best === null || day.salesCents >= daily[best]!.salesCents)) {
      best = index;
    }
  });
  return best;
}

export type SetupStepState = "done" | "current" | "in_progress" | "pending" | "error";

export interface SetupStep {
  key: "account" | "terms" | "data" | "documents" | "verification";
  title: string;
  state: SetupStepState;
  detail: string;
}

/**
 * The setup of the Painel (Configuração pendente, 298:3589), the Recebimento steps as the API
 * knows them: the terms count as accepted once the BlindPay customer exists, or when the flow kept
 * the acceptance; data and documents only exist once sent. `rfiDeadline` is "3 nov".
 */
export function setupSteps(
  producer: ProducerProfile,
  { termsAccepted, rfiDeadline }: { termsAccepted: boolean; rfiDeadline: string | null },
): SetupStep[] {
  const kyc = producer.compliance.status;
  const sent = kyc !== null;
  const stellar = producer.stellar.status;

  const account: SetupStep =
    stellar === "active"
      ? { key: "account", title: "Conta de recebimento", state: "done", detail: "Pronta" }
      : stellar === "failed"
        ? {
            key: "account",
            title: "Conta de recebimento",
            state: "error",
            detail: "Não deu para preparar",
          }
        : {
            key: "account",
            title: "Conta de recebimento",
            state: "in_progress",
            detail: "Preparando…",
          };
  const termsDone = sent || termsAccepted;
  const terms: SetupStep = termsDone
    ? { key: "terms", title: "Termos da BlindPay", state: "done", detail: "Aceitos" }
    : { key: "terms", title: "Termos da BlindPay", state: "current", detail: "Agora" };
  const data: SetupStep = sent
    ? { key: "data", title: "Seus dados", state: "done", detail: "Preenchidos" }
    : {
        key: "data",
        title: "Seus dados",
        state: termsDone ? "current" : "pending",
        detail: "Nome, CPF e endereço",
      };
  const documents: SetupStep = sent
    ? { key: "documents", title: "Documentos", state: "done", detail: "Enviados" }
    : {
        key: "documents",
        title: "Documentos",
        state: "pending",
        detail: "Documento com foto e selfie",
      };
  return [account, terms, data, documents, verificationStep(producer, rfiDeadline)];
}

function verificationStep(producer: ProducerProfile, rfiDeadline: string | null): SetupStep {
  const step = (state: SetupStepState, detail: string): SetupStep => ({
    key: "verification",
    title: "Verificação",
    state,
    detail,
  });
  const { status, hasOpenRfi } = producer.compliance;
  if (status === "compliance_request" || (status === "approved_rfi" && hasOpenRfi)) {
    return step(
      "current",
      rfiDeadline === null ? "A BlindPay pediu informações" : `Responder até ${rfiDeadline}`,
    );
  }
  if (producer.onboardingStatus === "ready") {
    return step("done", "Aprovada");
  }
  switch (status) {
    case null:
      return step("pending", "Costuma levar poucos minutos");
    case "verifying":
      return step("in_progress", "Em análise");
    case "rejected":
      return step("error", "Recusada");
    default:
      return step("in_progress", "Liberando o recebimento…");
  }
}
