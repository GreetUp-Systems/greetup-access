"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getProducer,
  listEvents,
  type ProducerEvent,
  type ProducerProfile,
} from "../../_lib/api/producer";
import { failureRoute, isWaiting, PRODUCER_POLL_MS } from "../../_lib/producer/gate";

export type ProducerSystemState =
  | { status: "loading" }
  | { status: "create_profile" }
  | { status: "sign_in" }
  | { status: "failed" }
  | { status: "ready"; producer: ProducerProfile; events: ProducerEvent[] };

/**
 * What the whole system needs before it opens (SPEC-015 §6): the producer (GET /producers/me) and
 * their events (GET /events), for the navigation count and the lists. Afterwards the producer is
 * read again every 10 s while a step waits (D-17), and the events whenever a page asks; a failed
 * re-read keeps what is on the screen. Loads once per session (`signedIn`).
 */
export function useProducerSystem(getToken: () => Promise<string>, signedIn: boolean) {
  const [state, setState] = useState<ProducerSystemState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  // As in the checkout: Privy's token function changes identity, and that must not reload the
  // system (an open menu would close, the screen would flash the loading state).
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    // A new session (signed in again after an expired one) starts over.
    setState((current) => (current.status === "loading" ? current : { status: "loading" }));
    let cancelled = false;
    void (async () => {
      let token: string;
      try {
        token = await tokenRef.current();
      } catch (error) {
        if (!cancelled) {
          setState({ status: failureRoute(error) });
        }
        return;
      }
      // Side by side; the producer's failure decides, since without a producer there is no list.
      const [producer, events] = await Promise.allSettled([getProducer(token), listEvents(token)]);
      if (cancelled) {
        return;
      }
      if (producer.status === "rejected") {
        setState({ status: failureRoute(producer.reason) });
      } else if (events.status === "rejected") {
        setState({ status: failureRoute(events.reason) });
      } else {
        setState({ status: "ready", producer: producer.value, events: events.value });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, attempt]);

  const reloadProducer = useCallback(async (): Promise<void> => {
    try {
      const producer = await getProducer(await tokenRef.current());
      setState((current) => (current.status === "ready" ? { ...current, producer } : current));
    } catch {
      // The screen keeps the last state; the next re-read tries again.
    }
  }, []);

  const reloadEvents = useCallback(async (): Promise<void> => {
    try {
      const events = await listEvents(await tokenRef.current());
      setState((current) => (current.status === "ready" ? { ...current, events } : current));
    } catch {
      // Same: the list on the screen stays until a re-read works.
    }
  }, []);

  const producer = state.status === "ready" ? state.producer : null;
  useEffect(() => {
    if (producer === null || !isWaiting(producer)) {
      return;
    }
    const timer = setTimeout(() => {
      void reloadProducer().then(() => setPollTick((tick) => tick + 1));
    }, PRODUCER_POLL_MS);
    return () => clearTimeout(timer);
  }, [producer, pollTick, reloadProducer]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry, reloadProducer, reloadEvents };
}
