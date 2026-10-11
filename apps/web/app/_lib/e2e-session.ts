"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AccountView } from "./api/account";
import { publicEnv } from "./env";

/**
 * The key a test sets in the browser to choose the session (Playwright's addInitScript): "1" for
 * the buyer, "anonymous" for a visitor, or the name of a producer scenario the simulated API
 * answers (e2e/mock-api.mjs). "Sair" writes "anonymous", so the next page stays signed out.
 */
export const E2E_SESSION_KEY = "access-e2e-session";
export const E2E_ANONYMOUS = "anonymous";

/** The buyer of the end-to-end tests; the simulated API answers for this token. */
export const e2eAccount: AccountView = {
  user: { id: "00000000-0000-4000-8000-0000000000e2", email: "comprador@example.com" },
  wallet: { address: `G${"E".repeat(55)}`, chainType: "stellar" },
};
export const E2E_TOKEN = "e2e-session-token";

/** The producer of the scenarios, with the e-mail of the Figma screens. */
export const e2eProducerAccount: AccountView = {
  user: { id: "00000000-0000-4000-8000-0000000000f2", email: "voce@email.com" },
  wallet: { address: `G${"F".repeat(55)}`, chainType: "stellar" },
};

export interface E2ESession {
  token: string;
  account: AccountView;
}

/** A signed-in test session, or the visitor. */
export type E2EState = E2ESession | typeof E2E_ANONYMOUS;

/**
 * The session a stored value asks for: the buyer for "1", the visitor for "anonymous", a producer
 * scenario otherwise.
 */
export function e2eSessionFor(value: string | null): E2EState | null {
  if (value === null || value === "") {
    return null;
  }
  if (value === E2E_ANONYMOUS) {
    return E2E_ANONYMOUS;
  }
  return value === "1"
    ? { token: E2E_TOKEN, account: e2eAccount }
    : { token: `${E2E_TOKEN}:${value}`, account: e2eProducerAccount };
}

/**
 * The test session of this page: only in the end-to-end build (NEXT_PUBLIC_E2E_SESSION,
 * SPEC-014 §11) and only when the test asked for it, so the other tests keep the real Privy. Read
 * after mount, so the server and the first render agree. `signOut` turns it into the visitor.
 */
export function useE2ESession(): { session: E2EState | null; signOut: () => void } {
  const [session, setSession] = useState<E2EState | null>(null);
  useEffect(() => {
    if (!publicEnv.e2eSession) {
      return;
    }
    try {
      setSession(e2eSessionFor(window.localStorage.getItem(E2E_SESSION_KEY)));
    } catch {
      setSession(null);
    }
  }, []);
  const signOut = useCallback(() => {
    try {
      window.localStorage.setItem(E2E_SESSION_KEY, E2E_ANONYMOUS);
    } catch {
      // The state below is enough for this page.
    }
    setSession(E2E_ANONYMOUS);
  }, []);
  return useMemo(() => ({ session, signOut }), [session, signOut]);
}
