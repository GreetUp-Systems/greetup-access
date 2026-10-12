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
import {
  getTicket,
  listTickets,
  type TicketDetailView,
  type TicketView,
} from "../../_lib/api/tickets";
import { useSession } from "../../_lib/session";

export type MyTicketsState =
  { status: "loading" } | { status: "failed" } | { status: "ready"; tickets: TicketView[] };

/** One ticket read on its own, with its QR token (GET /api/me/tickets/:id). */
export type TicketDetailState =
  | { status: "loading" }
  | { status: "failed" }
  /** Another person's ticket or no ticket at all: the API answers 404, or 400 for a bad id. */
  | { status: "not_found" }
  | { status: "ready"; ticket: TicketDetailView };

interface MyTicketsValue {
  state: MyTicketsState;
  retry: () => void;
  details: Readonly<Record<string, TicketDetailState>>;
  /**
   * Reads these tickets on their own, the ones not read yet or that failed; `again` reads them
   * anyway, to follow a ticket being issued. A failed re-read keeps what was read before.
   */
  readTickets: (ids: readonly string[], again?: boolean) => void;
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
function isRefusedSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** The API's answer to someone else's ticket (404) or to an id that is not a UUID (400). */
function isMissingTicket(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

/**
 * The buyer's tickets (GET /api/me/tickets) and the ones opened (GET /api/me/tickets/:id), kept
 * for the session in the /me/tickets layout: Meus ingressos and the opened ticket share them, and
 * moving between the tickets of an event never reads one again (SPEC-014 M11). A refused session
 * ends the Privy session, and the buyer area asks for the code (M10).
 */
export function MyTicketsProvider({ children }: { children: ReactNode }) {
  const { state: session, getToken, logout } = useSession();
  const [state, setState] = useState<MyTicketsState>({ status: "loading" });
  // The tickets read on their own belong to the session that read them: a new one starts empty.
  const [read, setRead] = useState<{
    owner: string | null;
    details: Record<string, TicketDetailState>;
  }>({ owner: null, details: {} });
  const [attempt, setAttempt] = useState(0);
  // Privy's functions change identity on every render: read them by ref, so nothing is read again
  // for that (as in useSiteAccount).
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  // The reads in flight, by session and ticket, so two screens asking for one ticket read it once.
  const reading = useRef(new Set<string>());

  const userId = session.status === "authenticated" ? session.account.user.id : null;
  const userRef = useRef(userId);
  userRef.current = userId;
  const details = useMemo(() => (read.owner === userId ? read.details : {}), [read, userId]);
  const detailsRef = useRef(details);
  detailsRef.current = details;

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

  const readTickets = useCallback(
    (ids: readonly string[], again = false) => {
      const owner = userId;
      if (owner === null) {
        return;
      }
      // Writes one ticket for this session; a newer session's state is never touched.
      const put = (
        id: string,
        next: (before: TicketDetailState | undefined) => TicketDetailState,
      ) =>
        setRead((current) => {
          const base = current.owner === owner ? current.details : {};
          return { owner, details: { ...base, [id]: next(base[id]) } };
        });
      for (const id of ids) {
        const key = `${owner}:${id}`;
        const known = detailsRef.current[id];
        const settled = known !== undefined && known.status !== "failed";
        if (reading.current.has(key) || (settled && !again)) {
          continue;
        }
        reading.current.add(key);
        if (!settled) {
          put(id, () => ({ status: "loading" }));
        }
        void (async () => {
          let next: TicketDetailState | null;
          try {
            const ticket = await getTicket(await tokenRef.current(), id);
            next = { status: "ready", ticket };
          } catch (error) {
            if (isRefusedSession(error)) {
              void logoutRef.current();
              next = null;
            } else if (isMissingTicket(error)) {
              next = { status: "not_found" };
            } else {
              next = { status: "failed" };
            }
          }
          reading.current.delete(key);
          if (next === null || userRef.current !== owner) {
            return;
          }
          const answer = next;
          // A failed re-read keeps the ticket on the screen; the next one tries again.
          put(id, (before) =>
            answer.status === "failed" && before?.status === "ready" ? before : answer,
          );
          if (answer.status === "ready") {
            // The list follows the ticket (issued meanwhile), without its QR token.
            setState((current) =>
              current.status === "ready"
                ? {
                    ...current,
                    tickets: current.tickets.map((listed) =>
                      listed.id === id ? withoutQr(answer.ticket) : listed,
                    ),
                  }
                : current,
            );
          }
        })();
      }
    },
    [userId],
  );

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const value = useMemo(
    () => ({ state, retry, details, readTickets }),
    [state, retry, details, readTickets],
  );
  return <MyTicketsContext.Provider value={value}>{children}</MyTicketsContext.Provider>;
}

// The list never keeps a QR token: only the opened ticket shows it (SPEC-008 invariant 3).
function withoutQr(ticket: TicketDetailView): TicketView {
  const listed: Partial<Pick<TicketDetailView, "qrToken">> & TicketView = { ...ticket };
  delete listed.qrToken;
  return listed;
}
