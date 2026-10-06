"use client";

import { useEffect, useState } from "react";

import type { AccountView } from "./api/account";
import { publicEnv } from "./env";

/** The key a test sets in the browser to start signed in (Playwright's addInitScript). */
export const E2E_SESSION_KEY = "access-e2e-session";

/** The buyer of the end-to-end tests; the simulated API answers for this token. */
export const e2eAccount: AccountView = {
  user: { id: "00000000-0000-4000-8000-0000000000e2", email: "comprador@example.com" },
  wallet: { address: `G${"E".repeat(55)}`, chainType: "stellar" },
};
export const E2E_TOKEN = "e2e-session-token";

/**
 * Whether this page runs the test session: only in the end-to-end build (NEXT_PUBLIC_E2E_SESSION,
 * SPEC-014 §11) and only when the test asked for it, so the other tests keep the real Privy. Read
 * after mount, so the server and the first render agree.
 */
export function useE2ESession(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!publicEnv.e2eSession) {
      return;
    }
    try {
      setActive(window.localStorage.getItem(E2E_SESSION_KEY) === "1");
    } catch {
      setActive(false);
    }
  }, []);
  return active;
}
