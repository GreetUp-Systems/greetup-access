"use client";

import { usePrivy } from "@privy-io/react-auth";
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

import {
  type AccountView,
  activateStellarAccount,
  bootstrapAccount,
  type BootstrapOrigin,
  getAccount,
} from "./api/account";
import { ApiError } from "./api/client";

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; account: AccountView }
  | { status: "error"; error: ApiError };

interface SessionContextValue {
  state: SessionState;
  /** A fresh Privy access token for the API; throws `session_expired` without a session. */
  getToken: () => Promise<string>;
  /**
   * Runs after the e-mail code is accepted: bootstraps the account with the origin and, on
   * "Entrar", starts the Stellar activation without waiting for it (SPEC-014 §7).
   */
  completeLogin: (origin: BootstrapOrigin) => Promise<AccountView>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken, logout: privyLogout } = usePrivy();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  // While a login is completing, the restore below must not race the bootstrap.
  const completing = useRef(false);
  const hasAccount = state.status === "authenticated";

  const getToken = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    if (token === null) {
      throw new ApiError(401, "session_expired", "There is no active session.", null);
    }
    return token;
  }, [getAccessToken]);

  // An existing Privy session (a reload, another tab) skips the identification.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!authenticated) {
      setState({ status: "anonymous" });
      return;
    }
    if (completing.current || hasAccount) {
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const account = await restoreAccount(await getToken());
        if (!cancelled) {
          setState({ status: "authenticated", account });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", error: toApiError(error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, hasAccount, getToken]);

  const completeLogin = useCallback(
    async (origin: BootstrapOrigin): Promise<AccountView> => {
      completing.current = true;
      try {
        const token = await getToken();
        const account = await bootstrapAccount(token, origin);
        setState({ status: "authenticated", account });
        if (origin === "login") {
          // Activation is by intent and idempotent: if it fails here, the next intent (a
          // confirmed payment) tries again, so it never blocks the navigation.
          void activateStellarAccount(token).catch(() => undefined);
        }
        return account;
      } finally {
        completing.current = false;
      }
    },
    [getToken],
  );

  const logout = useCallback(async (): Promise<void> => {
    await privyLogout();
    setState({ status: "anonymous" });
  }, [privyLogout]);

  const value = useMemo(
    () => ({ state, getToken, completeLogin, logout }),
    [state, getToken, completeLogin, logout],
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

/** The account behind a Privy session; a bootstrap that never finished is finished now. */
async function restoreAccount(token: string): Promise<AccountView> {
  try {
    return await getAccount(token);
  } catch (error) {
    if (error instanceof ApiError && error.code === "account_not_bootstrapped") {
      // "checkout" grants nothing (D-23): a restore must not count as a spontaneous login.
      return bootstrapAccount(token, "checkout");
    }
    throw error;
  }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, "unexpected_error", "Unexpected session failure.", null);
}
