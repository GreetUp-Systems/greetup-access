import { apiRequest } from "./client";

// Mirrors of the API views (apps/api/src/users/users.types.ts and
// apps/api/src/accounts/account-activation.service.ts).

export interface AccountView {
  user: { id: string; email: string };
  wallet: { address: string; chainType: "stellar" };
}

/** "signing" carries the hash the user's wallet signs in the browser (D-28). */
export type AccountActivationView =
  | { status: "signing"; hashToSign: string }
  | { status: "submitted" | "active"; transactionHash: string | null };

/** Where the e-mail code was typed: inside a checkout or on "Entrar" (D-23). */
export type BootstrapOrigin = "checkout" | "login";

/** Creates or finds the account and its wallet after the e-mail code (SPEC-003). */
export function bootstrapAccount(token: string, origin: BootstrapOrigin): Promise<AccountView> {
  return apiRequest<AccountView>("/auth/bootstrap", { method: "POST", token, body: { origin } });
}

/** The bootstrapped account; 404 `account_not_bootstrapped` when bootstrap never finished. */
export function getAccount(token: string): Promise<AccountView> {
  return apiRequest<AccountView>("/me", { token });
}

/** Prepares the Stellar account activation by intent (D-23); idempotent on the API side. */
export function prepareStellarActivation(token: string): Promise<AccountActivationView> {
  return apiRequest<AccountActivationView>("/me/stellar/activate", { method: "POST", token });
}

/** Sends the wallet's signature of the prepared hash; the API submits it with the sponsor's. */
export function submitStellarActivationSignature(
  token: string,
  body: { hash: string; signature: string },
): Promise<AccountActivationView> {
  return apiRequest<AccountActivationView>("/me/stellar/activate/signature", {
    method: "POST",
    token,
    body,
  });
}
