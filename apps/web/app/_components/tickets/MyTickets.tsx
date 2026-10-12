"use client";

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

import { ApiError } from "../../_lib/api/client";
import { listTickets, type TicketView } from "../../_lib/api/tickets";
import { useSession } from "../../_lib/session";

export type MyTicketsState =
  { status: "loading" } | { status: "failed" } | { status: "ready"; tickets: TicketView[] };

interface MyTicketsValue {
  state: MyTicketsState;
  retry: () => void;
  /** A ticket read on its own (the opened one, issued meanwhile) replaces its line in the list. */
  update: (ticket: TicketView) => void;
}

const MyTicketsContext = createContext<MyTicketsValue | null>(null);

export function useMyTickets(): MyTicketsValue {
  const context = useContext(MyTicketsContext);
  if (context === null) {
    throw new Error("useMyTickets must be used inside MyTicketsProvider.");
  }
  return context;
}

/** A refused session (401): the API no longer accepts the token (SPEC-014 M10). */
export function isRefusedSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * The buyer's tickets (GET /api/me/tickets), read once per session for Meus ingressos and the
 * opened ticket, so swiping between the tickets of an event never reads them again (SPEC-014 M11).
 * A refused session ends the Privy session, and the buyer area asks for the code (M10).
 */
export function MyTicketsProvider({ children }: { children: ReactNode }) {
  const { state: session, getToken, logout } = useSession();
  const [state, setState] = useState<MyTicketsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Privy's functions change identity on every render: read them by ref, so the list is not read
  // again for that (as in useSiteAccount).
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const userId = session.status === "authenticated" ? session.account.user.id : null;
  useEffect(() => {
    setState((current) => (current.status === "loading" ? current : { status: "loading" }));
    if (userId === null) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const { tickets } = await listTickets(await tokenRef.current(), controller.signal);
        setState({ status: "ready", tickets });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (isRefusedSession(error)) {
          void logoutRef.current();
          return;
        }
        setState({ status: "failed" });
      }
    })();
    return () => controller.abort();
  }, [userId, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const update = useCallback((ticket: TicketView) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            tickets: current.tickets.map((listed) =>
              listed.id === ticket.id ? withoutQr(ticket) : listed,
            ),
          }
        : current,
    );
  }, []);

  const value = useMemo(() => ({ state, retry, update }), [state, retry, update]);
  return <MyTicketsContext.Provider value={value}>{children}</MyTicketsContext.Provider>;
}

// The list never keeps a QR token: only the opened ticket shows it (SPEC-008 invariant 3).
function withoutQr(ticket: TicketView): TicketView {
  if (!("qrToken" in ticket)) {
    return ticket;
  }
  const listed: TicketView & { qrToken?: unknown } = { ...ticket };
  delete listed.qrToken;
  return listed;
}
