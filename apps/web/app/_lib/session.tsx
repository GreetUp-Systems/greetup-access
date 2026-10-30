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

import {
  accountActivationRoutes,
  activateAndConfirm,
  type ConfirmedActivation,
  producerActivationRoutes,
  signatureRequired,
  type SignStellarHash,
} from "./account-activation";
import { type ActivationQueue, createActivationQueue } from "./activation-queue";
import { type AccountView, bootstrapAccount, type BootstrapOrigin } from "./api/account";
import { ApiError } from "./api/client";
import { E2E_ANONYMOUS, type E2EState, useE2ESession } from "./e2e-session";
import { restoreSession } from "./session-restore";

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; account: AccountView };

export interface ProducerActivationOptions {
  /** False resumes the receiving account without asking the wallet (SPEC-015 R6). */
  sign?: boolean;
}

/** The producer's activation, signed or resumed without the wallet, in the page's queue (R7). */
function runProducerActivation(
  queue: ActivationQueue<ConfirmedActivation>,
  getToken: () => Promise<string>,
  signer: SignStellarHash,
  options: ProducerActivationOptions,
): Promise<ConfirmedActivation> {
  const resume = options.sign === false;
  return queue.run(resume ? "producer-resume" : "producer", () =>
    activateAndConfirm(producerActivationRoutes, getToken, resume ? signatureRequired : signer),
  );
}

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
  /**
   * Activates the Stellar account, signed in this browser, once the user is known (D-23, D-28):
   * after "Entrar" and when a checkout sees its payment confirmed. Never blocks the screen.
   */
  requestActivation: () => void;
  /**
   * Prepares the producer's receiving account, signed in this browser (SPEC-015 §6, D-28), and
   * waits for the network. It runs after the buyer's activation has ended (R7); asked again while
   * it waits or runs, it is the same run. With `sign: false` it resumes without the wallet (R6):
   * it prepares, follows a submitted transaction and registers the BlindPay wallet, and ends with
   * SignatureRequiredError when a signature is missing. Rejects with the API's error, the
   * wallet's, or ActivationUnconfirmedError.
   */
  activateProducerAccount: (options?: ProducerActivationOptions) => Promise<ConfirmedActivation>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const noSession = (): ApiError =>
  new ApiError(401, "session_expired", "There is no active session.", null);

// The end-to-end build has no wallet: it signs with a fixed value, for the simulated API to take
// (the simulated signature of SPEC-015 §10).
const e2eSignature: SignStellarHash = () => Promise.resolve(`0x${"e2".repeat(64)}` as const);

// The end-to-end build's visitor, or its signed-in buyer or producer (e2e-session.ts): no Privy.
// "Sair" turns the test session into the visitor.
function e2eSessionValue(
  e2e: E2EState,
  signOut: () => void,
  queue: ActivationQueue<ConfirmedActivation>,
): SessionContextValue {
  if (e2e === E2E_ANONYMOUS) {
    return {
      state: { status: "anonymous" },
      getToken: () => Promise.reject(noSession()),
      completeLogin: () =>
        Promise.reject(
          new ApiError(401, "session_expired", "The test visitor never signs in.", null),
        ),
      abandonLogin: () => Promise.resolve(),
      requestActivation: () => undefined,
      activateProducerAccount: () => Promise.reject(noSession()),
      logout: () => Promise.resolve(),
    };
  }
  const { token, account } = e2e;
  const getToken = (): Promise<string> => Promise.resolve(token);
  return {
    state: { status: "authenticated", account },
    getToken,
    completeLogin: () => Promise.resolve(account),
    abandonLogin: () => Promise.resolve(),
    requestActivation: () => undefined,
    activateProducerAccount: (options = {}) =>
      runProducerActivation(queue, getToken, e2eSignature, options),
    logout: () => {
      signOut();
      return Promise.resolve();
    },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout: privyLogout } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const { session: e2e, signOut: e2eSignOut } = useE2ESession();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [activationRequested, setActivationRequested] = useState(false);
  // One queue for the page: the buyer's and the producer's activations, one at a time (R7).
  const [activations] = useState(() => createActivationQueue<ConfirmedActivation>());
  // Only a session that existed when the page opened is restored; a login in progress is
  // completed by its own bootstrap, never by the restore (SPEC-014 §7).
  const openingChecked = useRef(false);
  // A queued activation signs when its turn comes, with the wallet hook of that moment.
  const signRawHashRef = useRef(signRawHash);
  useEffect(() => {
    signRawHashRef.current = signRawHash;
  }, [signRawHash]);

  const getToken = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    if (token === null) {
      throw noSession();
    }
    return token;
  }, [getAccessToken]);

  const signerFor = useCallback(
    (address: string): SignStellarHash =>
      async (hash) => {
        const { signature } = await signRawHashRef.current({
          address,
          chainType: "stellar",
          hash,
        });
        return signature;
      },
    [],
  );

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
    const sign = signerFor(state.account.wallet.address);
    // Activation is by intent and idempotent: if it fails here, the next intent (a confirmed
    // payment) tries again, so it never blocks the navigation. In the queue, it holds the
    // producer's until the network confirms it or it fails (R7).
    void activations
      .run("account", () => activateAndConfirm(accountActivationRoutes, getToken, sign))
      .catch(() => undefined);
  }, [activationRequested, state, user, getToken, signerFor, activations]);

  const activateProducerAccount = useCallback(
    (options: ProducerActivationOptions = {}): Promise<ConfirmedActivation> => {
      if (state.status !== "authenticated") {
        return Promise.reject(noSession());
      }
      const sign = signerFor(state.account.wallet.address);
      return runProducerActivation(activations, getToken, sign, options);
    },
    [state, getToken, signerFor, activations],
  );

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

  const requestActivation = useCallback(() => setActivationRequested(true), []);

  const logout = useCallback(async (): Promise<void> => {
    await privyLogout();
    setState({ status: "anonymous" });
  }, [privyLogout]);

  // The test session is one stable value for the page, whatever Privy does underneath.
  const e2eValue = useMemo(
    () => (e2e === null ? null : e2eSessionValue(e2e, e2eSignOut, activations)),
    [e2e, e2eSignOut, activations],
  );
  const value = useMemo(
    () =>
      e2eValue ?? {
        state,
        getToken,
        completeLogin,
        abandonLogin,
        requestActivation,
        activateProducerAccount,
        logout,
      },
    [
      e2eValue,
      state,
      getToken,
      completeLogin,
      abandonLogin,
      requestActivation,
      activateProducerAccount,
      logout,
    ],
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
