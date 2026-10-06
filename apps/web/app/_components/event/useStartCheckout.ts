"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { createPurchase } from "../../_lib/api/purchases";
import { type CreationNotice, creationNotice } from "../../_lib/checkout";
import { useSession } from "../../_lib/session";

export interface CheckoutStart {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
}

/** A notice the chooser shows, with the sold-out type's name for "Esgotou na escolha". */
export type ChooserNotice =
  | { kind: Exclude<CreationNotice, "event_closed" | "sold_out"> }
  | { kind: "sold_out"; ticketTypeName: string };

/**
 * Creates the order and opens the review (SPEC-014 §7). One Idempotency-Key per attempt: a retry
 * of the same choice reuses it, so the API answers the order already reserved; another choice
 * gets a new one.
 */
export function useStartCheckout(initialNotice: ChooserNotice | null) {
  const router = useRouter();
  const { getToken } = useSession();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<ChooserNotice | null>(initialNotice);
  const attempt = useRef<{ choice: string; key: string } | null>(null);

  const start = useCallback(
    async ({ ticketTypeId, ticketTypeName, quantity }: CheckoutStart): Promise<void> => {
      const choice = `${ticketTypeId}:${quantity}`;
      if (attempt.current?.choice !== choice) {
        attempt.current = { choice, key: crypto.randomUUID() };
      }
      setCreating(true);
      setNotice(null);
      try {
        const purchase = await createPurchase(
          await getToken(),
          { ticketTypeId, quantity },
          attempt.current.key,
        );
        router.push(`/checkout/${purchase.id}`);
      } catch (error) {
        const kind = creationNotice(error);
        if (kind === "sold_out" || kind === "event_closed") {
          // The page reads the event again: availability, or the closed sales.
          router.refresh();
        }
        if (kind === "sold_out") {
          setNotice({ kind, ticketTypeName });
        } else if (kind !== "event_closed") {
          setNotice({ kind });
        }
        setCreating(false);
      }
    },
    [getToken, router],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  return { start, creating, notice, clearNotice };
}
