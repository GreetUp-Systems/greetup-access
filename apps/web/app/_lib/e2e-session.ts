"use client";

import { useEffect, useState } from "react";

import type { AccountView } from "./api/account";
import { publicEnv } from "./env";

/**
 * The key a test sets in the browser to start signed in (Playwright's addInitScript): "1" for the
 * buyer, or the name of a producer scenario the simulated API answers (e2e/mock-api.mjs).
 */
export const E2E_SESSION_KEY = "access-e2e-session";

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

/** The session a stored value asks for: the buyer for "1", a producer scenario otherwise. */
export function e2eSessionFor(value: string | null): E2ESession | null {
  if (value === null || value === "") {
    return null;
  }
  return value === "1"
    ? { token: E2E_TOKEN, account: e2eAccount }
    : { token: `${E2E_TOKEN}:${value}`, account: e2eProducerAccount };
}

/**
 * The test session of this page: only in the end-to-end build (NEXT_PUBLIC_E2E_SESSION,
 * SPEC-014 §11) and only when the test asked for it, so the other tests keep the real Privy. Read
 * after mount, so the server and the first render agree.
 */
export function useE2ESession(): E2ESession | null {
  const [session, setSession] = useState<E2ESession | null>(null);
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
  return session;
}
