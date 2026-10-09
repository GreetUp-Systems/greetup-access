import type { ProducerProfile } from "../api/producer";

export interface ReceivingSummary {
  /** The Status beside "Conta de recebimento"; none before the verification starts. */
  status: "in_review" | "pending" | "rejected" | "approved" | null;
  /** Desktop: the line under "Conta de recebimento". */
  detail: string;
  /** Phone: the subtitle of the Recebimento row. */
  short: string;
}

/**
 * The summary of Recebimento on the producer profile (Desktop · Perfil · Recebimento por estado,
 * 433:3828; Mobile, 433:17580). An open request for information comes first, even on a producer
 * that can sell (approved_rfi).
 */
export function receivingSummary(producer: ProducerProfile): ReceivingSummary {
  const { status: kyc, hasOpenRfi } = producer.compliance;
  if (kyc === "compliance_request" || (kyc === "approved_rfi" && hasOpenRfi)) {
    return {
      status: "pending",
      detail: "A BlindPay pediu mais informações.",
      short: "Responder pedido",
    };
  }
  if (producer.onboardingStatus === "ready") {
    return {
      status: "approved",
      detail: "Conta ativa e verificação aprovada.",
      short: "Conta ativa",
    };
  }
  if (kyc === "rejected") {
    return {
      status: "rejected",
      detail: "A verificação foi recusada. Corrija os dados e envie de novo.",
      short: "Verificação recusada",
    };
  }
  if (kyc === "verifying") {
    return {
      status: "in_review",
      detail: "Seus dados estão em análise na BlindPay.",
      short: "Dados enviados",
    };
  }
  if (kyc === "approved" || kyc === "approved_rfi") {
    return {
      status: "approved",
      detail: "Verificação aprovada. Liberando o recebimento…",
      short: "Liberando a conta…",
    };
  }
  return {
    status: null,
    detail: "Termine a configuração para receber pelas vendas.",
    short: "Falta configurar",
  };
}
