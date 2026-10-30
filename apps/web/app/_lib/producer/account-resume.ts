import { ActivationUnconfirmedError, SignatureRequiredError } from "../account-activation";
import { ApiError } from "../api/client";
import type { ProducerProfile } from "../api/producer";

// The receiving account resumed in the background by the whole producer system (SPEC-015 R6,
// SPEC-003 §10) while it is on its way: it prepares without the wallet, follows a submitted
// transaction and registers the BlindPay wallet, with a limit of tries. When the signature is
// missing, the Recebimento asks for it. A `failed` account is never touched: only "Tentar de novo"
// of the Conta com erro prepares it again (R3).

/** Tries in a row that fail for a passing reason before the resume stops. */
export const RESUME_ATTEMPTS = 3;

/** The wait before the next try after a failure, or after a run that left the account as it was. */
export const RESUME_RETRY_MS = 10_000;

/** "sign" asks the wallet when the transaction waits for it; "resume" never does. */
export type ResumeMode = "sign" | "resume";

/**
 * What the system does for the receiving account now. `onReceiving` is true on the Recebimento's
 * pages, the place that asks for the signature: there, an account not started, pending or waiting
 * for its signature is prepared and signed. Elsewhere, only what needs no signature: a pending one
 * prepared, a submitted one followed, the wallet registered.
 */
export function resumeMode(producer: ProducerProfile, onReceiving: boolean): ResumeMode | null {
  const stellar = producer.stellar.status;
  if (stellar === "failed") {
    return null;
  }
  if (producer.onboardingStatus === "wallet_registration_pending" || stellar === "submitted") {
    return "resume";
  }
  if (stellar === "active") {
    return null;
  }
  // not_started, pending or signing: the signature is missing, or will be once it is prepared.
  if (onReceiving) {
    return "sign";
  }
  return stellar === "pending" ? "resume" : null;
}

/**
 * How a run ended: a signature that only the Recebimento asks for, a passing failure (the network,
 * 503 and other 5xx but 502, the wallet, a transaction not yet confirmed) that is tried again, or
 * one the resume stops at (502 `stellar_activation_failed`, which makes the account `failed`, 502
 * `blindpay_wallet_registration_failed`, 4xx).
 */
export type ResumeFailure = "signature_required" | "passing" | "definitive";

export function classifyResumeFailure(error: unknown): ResumeFailure {
  if (error instanceof SignatureRequiredError) {
    return "signature_required";
  }
  if (error instanceof ActivationUnconfirmedError) {
    return "passing";
  }
  if (error instanceof ApiError) {
    if (error.status === 0 || (error.status >= 500 && error.status !== 502)) {
      return "passing";
    }
    return "definitive";
  }
  // The wallet's own failure (a signature that did not happen).
  return "passing";
}

/** The resume's memory between runs. */
export interface ResumeState {
  /** Passing failures in a row. */
  failures: number;
  /** No run starts before this time (epoch ms). */
  notBefore: number;
  /** The error it stopped at, after the last try or a definitive failure; null while it goes on. */
  stoppedBy: { error: unknown } | null;
}

export const initialResumeState: ResumeState = { failures: 0, notBefore: 0, stoppedBy: null };

/** The state after a run: a success starts the count again; a passing failure waits and counts. */
export function afterRun(
  state: ResumeState,
  outcome: { ok: true } | { ok: false; error: unknown },
  now: number,
): ResumeState {
  if (outcome.ok) {
    return { failures: 0, notBefore: now + RESUME_RETRY_MS, stoppedBy: null };
  }
  const failure = classifyResumeFailure(outcome.error);
  if (failure === "signature_required") {
    return { ...state, notBefore: now };
  }
  if (failure === "definitive") {
    return { ...state, stoppedBy: { error: outcome.error } };
  }
  const failures = state.failures + 1;
  return {
    failures,
    notBefore: now + RESUME_RETRY_MS,
    stoppedBy: failures >= RESUME_ATTEMPTS ? { error: outcome.error } : null,
  };
}

/** The next run and how long to wait for it, or null when there is nothing to do. */
export function nextResume(
  producer: ProducerProfile,
  onReceiving: boolean,
  state: ResumeState,
  now: number,
): { mode: ResumeMode; delayMs: number } | null {
  if (state.stoppedBy !== null) {
    return null;
  }
  const mode = resumeMode(producer, onReceiving);
  return mode === null ? null : { mode, delayMs: Math.max(0, state.notBefore - now) };
}
