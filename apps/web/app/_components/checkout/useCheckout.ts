"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../_lib/api/client";
import {
  createPix,
  createPurchase,
  getPurchase,
  type PurchaseView,
} from "../../_lib/api/purchases";
import {
  changedPurchase,
  type CreationNotice,
  creationNotice,
  pixNotice,
} from "../../_lib/checkout";
import { useSession } from "../../_lib/session";

/** Figma: the review's toasts (Esgotou 175:2013, Total mudou 175:4622, Erro de conexão 175:4714). */
export type ReviewNotice = "sold_out" | "total_changed" | "connection";

type Loaded =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "failed" }
  | { status: "ready"; purchase: PurchaseView };

// The chooser's notices for a total out of the Pix range (SPEC-014 §7).
const backToChooser = {
  below_minimum: "valor-minimo",
  above_maximum: "valor-maximo",
} as const;

/**
 * The checkout of one order (SPEC-014 §7): reads it, generates the Pix for the total shown, and
 * turns every refusal into its screen. An expired reservation is created again with the same
 * choice, so the buyer does not start over.
 */
export function useCheckout(purchaseId: string) {
  const router = useRouter();
  const { state, getToken } = useSession();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [notice, setNotice] = useState<ReviewNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const authenticated = state.status === "authenticated";
  // Read once per order and session: a token function that changes identity must not reload the
  // order in the middle of a step (an expired reservation reads as payment_failed).
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const purchase = await getPurchase(await tokenRef.current(), purchaseId);
        if (!cancelled) {
          setLoaded({ status: "ready", purchase });
        }
      } catch (error) {
        if (!cancelled) {
          setLoaded(
            error instanceof ApiError && error.status === 404
              ? { status: "missing" }
              : { status: "failed" },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, purchaseId]);

  const show = useCallback(
    (purchase: PurchaseView) => setLoaded({ status: "ready", purchase }),
    [],
  );

  const toEvent = useCallback(
    (purchase: PurchaseView, aviso?: string) =>
      router.push(
        `/e/${encodeURIComponent(purchase.event.slug)}${aviso === undefined ? "" : `?aviso=${aviso}`}`,
      ),
    [router],
  );

  /** A new order with the same choice, or why it could not be created. */
  const recreate = useCallback(
    async (previous: PurchaseView): Promise<PurchaseView | CreationNotice> => {
      try {
        return await createPurchase(
          await getToken(),
          { ticketTypeId: previous.ticketTypeId, quantity: previous.quantity },
          crypto.randomUUID(),
        );
      } catch (error) {
        return creationNotice(error);
      }
    },
    [getToken],
  );

  // Where a failed re-creation leads from the review: Esgotou, the chooser, or a retry.
  const showCreationFailure = useCallback(
    (previous: PurchaseView, kind: CreationNotice): void => {
      if (kind === "sold_out") {
        setNotice("sold_out");
      } else if (kind === "below_minimum" || kind === "above_maximum") {
        toEvent(previous, backToChooser[kind]);
      } else if (kind === "event_closed") {
        toEvent(previous);
      } else {
        setNotice("connection");
      }
    },
    [toEvent],
  );

  const pay = useCallback(
    async (purchase: PurchaseView, allowRecreate: boolean): Promise<void> => {
      try {
        show(await createPix(await getToken(), purchase.id, purchase.totalCents ?? 0));
      } catch (error) {
        const kind = pixNotice(error);
        if (kind === "total_changed") {
          const updated = changedPurchase(error);
          if (updated !== null) {
            show(updated);
          }
          setNotice("total_changed");
        } else if (kind === "expired" && allowRecreate) {
          const fresh = await recreate(purchase);
          if (typeof fresh === "string") {
            showCreationFailure(purchase, fresh);
            return;
          }
          // The review stays on screen; only the address follows the new order.
          window.history.replaceState(null, "", `/checkout/${fresh.id}`);
          show(fresh);
          if (fresh.totalCents === purchase.totalCents) {
            await pay(fresh, false);
          } else {
            setNotice("total_changed");
          }
        } else if (kind === "not_completed") {
          try {
            show(await getPurchase(await getToken(), purchase.id));
          } catch {
            setNotice("connection");
          }
        } else if (kind === "below_minimum" || kind === "above_maximum") {
          toEvent(purchase, backToChooser[kind]);
        } else {
          setNotice("connection");
        }
      }
    },
    [getToken, recreate, show, showCreationFailure, toEvent],
  );

  /** "Gerar Pix", and "Tentar de novo" after a connection error. */
  const generatePix = useCallback(async (): Promise<void> => {
    if (loaded.status !== "ready" || busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await pay(loaded.purchase, true);
    } finally {
      setBusy(false);
    }
  }, [busy, loaded, pay]);

  /** "Tentar novamente" after a payment that did not complete: a new order, same choice. */
  const retryPurchase = useCallback(async (): Promise<void> => {
    if (loaded.status !== "ready" || busy) {
      return;
    }
    setBusy(true);
    const fresh = await recreate(loaded.purchase);
    if (typeof fresh !== "string") {
      router.push(`/checkout/${fresh.id}`);
    } else if (fresh === "below_minimum" || fresh === "above_maximum") {
      toEvent(loaded.purchase, backToChooser[fresh]);
    } else {
      // Sold out, closed or unreachable: the event page shows where things stand.
      toEvent(loaded.purchase);
    }
    setBusy(false);
  }, [busy, loaded, recreate, router, toEvent]);

  return { loaded, notice, busy, generatePix, retryPurchase, toEvent, show };
}
