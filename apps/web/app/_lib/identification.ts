/** The code is resent at most once a minute (SPEC-014 §7). */
export const RESEND_INTERVAL_MS = 60_000;

/** Privy e-mail codes have six digits. */
export const CODE_LENGTH = 6;

// Enough to catch typos before asking Privy; Privy does the real validation.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value.trim());
}

/** Keeps only digits, at most six: typing, pasting and the OS autofill all go through here. */
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** "0:42" for the resend countdown. */
export function formatCountdown(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type LoginFailure = "wrong_code" | "service";

/**
 * A wrong or expired code is the user's to fix (the boxes turn red); anything else is a failure
 * of Privy or the network (the error toast).
 */
export function classifyLoginError(error: unknown): LoginFailure {
  if (typeof error === "object" && error !== null && "privyErrorCode" in error) {
    const code = (error as { privyErrorCode?: unknown }).privyErrorCode;
    if (code === "invalid_credentials" || code === "invalid_data") {
      return "wrong_code";
    }
  }
  return "service";
}
