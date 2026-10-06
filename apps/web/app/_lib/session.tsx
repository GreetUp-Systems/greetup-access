"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { activateStellarAccount } from "./account-activation";
import { type AccountView, bootstrapAccount, type BootstrapOrigin } from "./api/account";
import { ApiError } from "./api/client";
import { E2E_TOKEN, e2eAccount, useE2ESession } from "./e2e-session";
import { restoreSession } from "./session-restore";

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; account: AccountView };

interface SessionContextValue {
  state: SessionState;
  /** A fresh Privy access token for the API; throws `session_expired` without a session. */
  getToken: () => Promise<string>;
  /**
   * Runs after the e-mail code is accepted: bootstraps the account with the origin and, on
   * "Entrar", starts the Stellar activation without waiting for it (SPEC-014 §7).
   */
  completeLogin: (origin: BootstrapOrigin) => Promise<AccountView>;
  /** Closing the identification midway ends a Privy session that never got its account. */
  abandonLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// The end-to-end build's signed-in buyer (e2e-session.ts): stable functions, no Privy.
const e2eSessionValue: SessionContextValue = {
  state: { status: "authenticated", account: e2eAccount },
  getToken: () => Promise.resolve(E2E_TOKEN),
  completeLogin: () => Promise.resolve(e2eAccount),
  abandonLogin: () => Promise.resolve(),
  logout: () => Promise.resolve(),
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout: privyLogout } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const e2e = useE2ESession();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [activationRequested, setActivationRequested] = useState(false);
  // Only a session that existed when the page opened is restored; a login in progress is
  // completed by its own bootstrap, never by the restore (SPEC-014 §7).
  const openingChecked = useRef(false);

  const getToken = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    if (token === null) {
      throw new ApiError(401, "session_expired", "There is no active session.", null);
    }
    return token;
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const opening = !openingChecked.current;
    openingChecked.current = true;
    if (!authenticated) {
      setState({ status: "anonymous" });
      return;
    }
    if (!opening) {
      return;
    }

    let cancelled = false;
    let finished = false;
    void (async () => {
      const account = await restoreSession(getToken, privyLogout);
      finished = true;
      if (!cancelled) {
        setState(account === null ? { status: "anonymous" } : { status: "authenticated", account });
      }
    })();
    return () => {
      cancelled = true;
      // Interrupted before it finished (React runs effects twice in development): the next run
      // is still the page opening.
      if (!finished) {
        openingChecked.current = false;
      }
    };
  }, [ready, authenticated, getToken, privyLogout]);

  // The activation runs once Privy exposes the signed-in user: signRawHash from the render that
  // called completeLogin still sees the user signed out.
  useEffect(() => {
    if (!activationRequested || state.status !== "authenticated" || user === null) {
      return;
    }
    setActivationRequested(false);
    const address = state.account.wallet.address;
    // Activation is by intent and idempotent: if it fails here, the next intent (a confirmed
    // payment) tries again, so it never blocks the navigation.
    void activateStellarAccount(getToken, async (hash) => {
      const { signature } = await signRawHash({ address, chainType: "stellar", hash });
      return signature;
    }).catch(() => undefined);
  }, [activationRequested, state, user, getToken, signRawHash]);

  const completeLogin = useCallback(
    async (origin: BootstrapOrigin): Promise<AccountView> => {
      const account = await bootstrapAccount(await getToken(), origin);
      setState({ status: "authenticated", account });
      if (origin === "login") {
        setActivationRequested(true);
      }
      return account;
    },
    [getToken],
  );

  const abandonLogin = useCallback(async (): Promise<void> => {
    if (authenticated && state.status !== "authenticated") {
      await privyLogout().catch(() => undefined);
    }
  }, [authenticated, state.status, privyLogout]);

  const logout = useCallback(async (): Promise<void> => {
    await privyLogout();
    setState({ status: "anonymous" });
  }, [privyLogout]);

  const value = useMemo(
    () => (e2e ? e2eSessionValue : { state, getToken, completeLogin, abandonLogin, logout }),
    [e2e, state, getToken, completeLogin, abandonLogin, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return context;
}
