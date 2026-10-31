import type { OpenRfi } from "../api/onboarding";
import type { ProducerProfile } from "../api/producer";
import { accountStep, type SetupStep, type SetupStepState } from "./dashboard";

// The results of the verification at /producer/receiving (SPEC-015 §6 "Resultados", §5.2): which
// screen the producer's state leads to, the notice of the receiving account above it, and the
// Etapas beside it.

/**
 * Em análise; Pendência (the request for information: loading, failing or its questions), its
 * Respondida and Prazo encerrado; Recusado; Aprovada · Conta a caminho; Liberando; Pronto.
 */
export type ReceivingResult =
  | "in_review"
  | "rfi"
  | "rfi_answered"
  | "rfi_expired"
  | "rejected"
  | "account_on_way"
  | "releasing"
  | "ready";

/** BlindPay asked for information: the customer is paused, or approved with the request open. */
export function rfiOpen(producer: ProducerProfile): boolean {
  const { status, hasOpenRfi } = producer.compliance;
  return status === "compliance_request" || (status === "approved_rfi" && hasOpenRfi);
}

/** The request as this page read it, and the one it answered, until the producer leaves it. */
export interface RfiRead {
  status: "loading" | "failed" | "loaded";
  /** The API's answer once loaded: the request, or null without one. */
  rfi: OpenRfi | null;
  /** The request answered from this page; BlindPay may still show it open for a moment. */
  answeredId: string | null;
}

/** The screen of a request: its `status` decides (§6 "Campos do RFI"); null goes on without it. */
function rfiResult(read: RfiRead): ReceivingResult | null {
  const rfi = read.status === "loaded" ? read.rfi : null;
  // Answered here: Respondida, unless BlindPay opened another request since.
  if (read.answeredId !== null && (rfi === null || rfi.id === read.answeredId)) {
    return "rfi_answered";
  }
  if (read.status !== "loaded") {
    return "rfi";
  }
  switch (rfi?.status) {
    case "pending":
      return "rfi";
    case "submitted":
      return "rfi_answered";
    case "expired":
      return "rfi_expired";
    default:
      // None, or cancelled by compliance: the verification goes on without it.
      return null;
  }
}

/**
 * The result on the root, while the configuration is not on it (§6 table). `open` is the
 * configuration's: a verification this page sent is in analysis until the producer is read again.
 */
export function receivingResult(
  producer: ProducerProfile,
  { open, rfi }: { open: boolean; rfi: RfiRead },
): ReceivingResult {
  const kyc = producer.compliance.status;
  if (rfiOpen(producer)) {
    const result = rfiResult(rfi);
    if (result !== null) {
      return result;
    }
  }
  if (kyc === null || kyc === "verifying" || kyc === "compliance_request") {
    return "in_review";
  }
  if (kyc === "rejected") {
    return open ? "rejected" : "in_review";
  }
  // Operational (approved, or approved with a request no longer open).
  if (producer.onboardingStatus === "ready") {
    return "ready";
  }
  return producer.onboardingStatus === "wallet_registration_pending"
    ? "releasing"
    : "account_on_way";
}

/**
 * The notice above the root (§6 "Conta de recebimento", R3, R6): "account" when the receiving
 * account failed, or its resume gave up while preparing it; "release" when it gave up registering
 * BlindPay's wallet (Liberando · Falha). Both offer "Tentar de novo".
 */
export type AccountNotice = "account" | "release" | null;

export function accountNotice(
  producer: ProducerProfile,
  { stopped }: { stopped: boolean },
): AccountNotice {
  if (producer.stellar.status === "failed") {
    return "account";
  }
  if (!stopped) {
    return null;
  }
  return producer.onboardingStatus === "wallet_registration_pending" ? "release" : "account";
}

function verificationOf(result: ReceivingResult, rfiDeadline: string | null): SetupStep {
  const step = (state: SetupStepState, detail: string): SetupStep => ({
    key: "verification",
    title: "Verificação",
    state,
    detail,
  });
  switch (result) {
    case "in_review":
      return step("in_progress", "Em análise");
    case "rfi":
      return step(
        "current",
        rfiDeadline === null ? "A BlindPay pediu informações" : `Responder até ${rfiDeadline}`,
      );
    case "rfi_answered":
      return step("in_progress", "Resposta enviada");
    case "rfi_expired":
      return step("in_progress", "Prazo encerrado");
    case "rejected":
      return step("error", "Recusada");
    case "releasing":
      return step("in_progress", "Liberando o recebimento…");
    case "account_on_way":
    case "ready":
      return step("done", "Aprovada");
  }
}

/**
 * The Etapas beside a result (Figma 301:3623 to 301:4545, 548:11301): everything was sent; the
 * receiving account as it is (an error under its notice); the verification as the result says.
 * `rfiDeadline` is "3 nov".
 */
export function resultSteps(
  producer: ProducerProfile,
  {
    result,
    rfiDeadline,
    notice,
  }: { result: ReceivingResult; rfiDeadline: string | null; notice: AccountNotice },
): SetupStep[] {
  return [
    accountStep(producer, notice === "account"),
    { key: "terms", title: "Termos da BlindPay", state: "done", detail: "Aceitos" },
    { key: "data", title: "Seus dados", state: "done", detail: "Preenchidos" },
    { key: "documents", title: "Documentos", state: "done", detail: "Enviados" },
    verificationOf(result, rfiDeadline),
  ];
}

/**
 * What happens without an answer: a paused verification is refused at the deadline; an approved
 * one keeps selling, and BlindPay reviews it by hand (approved_rfi).
 */
export function rfiConsequence(producer: ProducerProfile): string {
  return producer.compliance.status === "approved_rfi"
    ? "As vendas continuam enquanto isso."
    : "Sem resposta, a verificação é recusada.";
}
