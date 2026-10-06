"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { followPurchase, getPurchase, type PurchaseView } from "../../_lib/api/purchases";
import { getTicket, type TicketView } from "../../_lib/api/tickets";
import { useSession } from "../../_lib/session";

// After the stream (its 15 minutes, or a failure to open it), the order is read at this pace.
const pollMs = 5_000;

const followed = (status: PurchaseView["status"]): boolean =>
  status === "awaiting_payment" || status === "payment_confirmed";

/**
 * Follows a paid order until its tickets are issued (SPEC-014 §7, SPEC-008 §7): the stream says
 * when the stage changes and the order is read again; once the stream ends without a final
 * stage, the order is read every few seconds. Seeing the payment confirmed activates the
 * buyer's Stellar account (D-23), and an issued order brings its first ticket, with the QR.
 */
export function useFollowUp(
  purchase: PurchaseView | null,
  onPurchase: (purchase: PurchaseView) => void,
): { ticket: TicketView | null } {
  const { getToken, requestActivation } = useSession();
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const id = purchase?.id;
  const status = purchase?.status;
  const firstTicketId = purchase?.tickets[0]?.id;
  const active = status !== undefined && followed(status);

  const refresh = useCallback(async (): Promise<void> => {
    if (id === undefined) {
      return;
    }
    try {
      onPurchase(await getPurchase(await tokenRef.current(), id));
    } catch {
      // The next stage change or poll reads it again.
    }
  }, [id, onPurchase]);

  useEffect(() => {
    if (!active || id === undefined) {
      return;
    }
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    const startPolling = (): void => {
      if (poll === undefined && !controller.signal.aborted) {
        poll = setInterval(() => void refresh(), pollMs);
      }
    };
    void (async () => {
      try {
        await followPurchase(
          await tokenRef.current(),
          id,
          { onStage: () => void refresh(), onTimeout: startPolling },
          controller.signal,
        );
      } catch {
        // The stream could not be followed: reading the order still gets there.
      }
      // Ended without leaving the followed stages (a timeout, a failure): keep reading.
      startPolling();
    })();
    return () => {
      controller.abort();
      if (poll !== undefined) {
        clearInterval(poll);
      }
    };
  }, [active, id, refresh]);

  // The payment is the checkout buyer's intent: activate the account, once (D-23).
  const activationRequested = useRef(false);
  useEffect(() => {
    if (
      (status === "payment_confirmed" || status === "ticket_issued") &&
      !activationRequested.current
    ) {
      activationRequested.current = true;
      requestActivation();
    }
  }, [status, requestActivation]);

  useEffect(() => {
    if (status !== "ticket_issued" || firstTicketId === undefined) {
      return;
    }
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async (): Promise<void> => {
      try {
        const issued = await getTicket(await tokenRef.current(), firstTicketId);
        if (!cancelled) {
          setTicket(issued);
        }
      } catch {
        // The screen keeps the issuing state and tries again.
        if (!cancelled) {
          retry = setTimeout(() => void load(), pollMs);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (retry !== undefined) {
        clearTimeout(retry);
      }
    };
  }, [status, firstTicketId]);

  return { ticket };
}
