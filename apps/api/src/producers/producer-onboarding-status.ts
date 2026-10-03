import { type ProducerProfileRecord } from "./producers.repository";
import { type ProducerProfileView } from "./producers.types";

export type ProducerOnboardingStatus = ProducerProfileView["onboardingStatus"];

const operationalKycStatuses = new Set(["APPROVED", "APPROVED_RFI"]);

export function isOperationalKycStatus(kycStatus: string | null | undefined): boolean {
  return operationalKycStatuses.has(kycStatus ?? "");
}

// Stellar setup and compliance run independently; the first pending track wins (SPEC-003 §5).
export function deriveOnboardingStatus(producer: ProducerProfileRecord): ProducerOnboardingStatus {
  const customer = producer.blindPayCustomers[0];

  if (producer.stellarProvisioning?.status !== "ACTIVE") {
    return "stellar_pending";
  }
  if (customer === undefined || !isOperationalKycStatus(customer.kycStatus)) {
    return "compliance_pending";
  }
  if (customer.externalBlockchainWalletId === null) {
    return "wallet_registration_pending";
  }
  return "ready";
}
