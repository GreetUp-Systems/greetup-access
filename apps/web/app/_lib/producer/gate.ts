import { ApiError } from "../api/client";
import type { ProducerProfile } from "../api/producer";

/** The producer's state is read again this often while a step waits on someone else (D-17). */
export const PRODUCER_POLL_MS = 10_000;

/**
 * Where a failed load of the producer system leads (SPEC-015 N5): without a producer profile, to
 * Criar perfil; without a valid session, back to the identification; anything else is a failure
 * the screen offers to retry.
 */
export function failureRoute(error: unknown): "create_profile" | "sign_in" | "failed" {
  if (error instanceof ApiError) {
    if (error.status === 404 && error.code === "producer_not_found") {
      return "create_profile";
    }
    if (error.status === 401) {
      return "sign_in";
    }
  }
  return "failed";
}

/**
 * A step waits on someone other than the producer: BlindPay analysing the data, the network
 * confirming the receiving account, or the BlindPay wallet being registered. Steps that wait on
 * the producer (terms, data, documents, a request for information) are not re-read.
 */
export function isWaiting(producer: ProducerProfile): boolean {
  if (producer.onboardingStatus === "ready") {
    return false;
  }
  return (
    producer.compliance.status === "verifying" ||
    producer.stellar.status === "pending" ||
    producer.stellar.status === "submitted" ||
    producer.onboardingStatus === "wallet_registration_pending"
  );
}
