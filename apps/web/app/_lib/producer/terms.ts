import { stepHref } from "./receiving-flow";

// BlindPay's terms of service (SPEC-015 §6, Termos): accepted on BlindPay's site, which comes back
// to Seus dados with `tos_id` in the address. The id is kept in the tab's sessionStorage, per
// producer, until the verification is sent: the trip to BlindPay reloads the page, so the memory
// alone would lose it. It is not personal data, only the acceptance's reference.

const storageKey = (producerId: string): string => `access-receiving-terms:${producerId}`;

/** The accepted terms of this producer in this tab, or null. */
export function readAcceptedTerms(producerId: string): string | null {
  try {
    return tosIdFrom(window.sessionStorage.getItem(storageKey(producerId)));
  } catch {
    return null;
  }
}

/** Keeps the acceptance until the submission; without storage, the page's memory is enough. */
export function storeAcceptedTerms(producerId: string, tosId: string): void {
  try {
    window.sessionStorage.setItem(storageKey(producerId), tosId);
  } catch {
    // The memory of the page keeps it while the tab stays here.
  }
}

/** Each acceptance is good for one verification (R2): it goes once the verification is sent. */
export function clearAcceptedTerms(producerId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(producerId));
  } catch {
    // Nothing kept.
  }
}

/** BlindPay's `tos_id` from the address, or null for anything that is not an id. */
export function tosIdFrom(value: string | null): string | null {
  const id = value?.trim() ?? "";
  return /^[A-Za-z0-9_-]{1,200}$/.test(id) ? id : null;
}

/** Where BlindPay sends the producer back after the terms: Seus dados, on this origin. */
export function termsRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${stepHref("data")}`;
}

/** BlindPay's page of the terms is opened only on https, never another scheme. */
export function isTermsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
