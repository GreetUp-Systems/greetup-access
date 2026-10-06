import { publicEnv } from "../env";
import { ApiError, apiRequest } from "./client";

// Mirror of the purchase view (apps/api/src/purchases/purchases.types.ts, PurchaseView).
export type PurchaseStatus =
  | "initiated"
  | "awaiting_payment"
  | "payment_confirmed"
  | "ticket_issued"
  | "payment_failed"
  | "payment_refunded";

export interface PurchaseView {
  id: string;
  status: PurchaseStatus;
  eventId: string;
  ticketTypeId: string;
  event: {
    slug: string;
    name: string;
    startsAt: string;
    endsAt: string | null;
    venueName: string | null;
    address: string | null;
  };
  ticketType: { id: string; name: string };
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  serviceFeeCents: number | null;
  totalCents: number | null;
  pixCode: string | null;
  createdAt: string;
  tickets: Array<{ id: string; status: "pending_mint" | "issued"; tokenId: number | null }>;
}

/** Reserves and quotes (SPEC-005 §9): the service fee appears before any Pix. */
export function createPurchase(
  token: string,
  body: { ticketTypeId: string; quantity: number },
  idempotencyKey: string,
): Promise<PurchaseView> {
  return apiRequest<PurchaseView>("/purchases", { method: "POST", token, body, idempotencyKey });
}

export function getPurchase(token: string, purchaseId: string): Promise<PurchaseView> {
  return apiRequest<PurchaseView>(`/purchases/${encodeURIComponent(purchaseId)}`, { token });
}

/** Creates the Pix for the total the buyer saw; a different total answers 409. */
export function createPix(
  token: string,
  purchaseId: string,
  expectedTotalCents: number,
): Promise<PurchaseView> {
  return apiRequest<PurchaseView>(`/purchases/${encodeURIComponent(purchaseId)}/pix`, {
    method: "POST",
    token,
    body: { expectedTotalCents },
  });
}

/** The order's stage for the buyer, from the stream (SPEC-008 §7). */
export type PurchaseStage =
  "order_placed" | "awaiting_payment" | "payment_confirmed" | "ticket_issued" | "not_completed";

export interface PurchaseStreamHandlers {
  onStage: (stage: PurchaseStage) => void;
  /** The stream ran its 15 minutes; the caller reads the order from then on. */
  onTimeout: () => void;
}

// The server closed the stream (final stage or timeout): not a drop to reconnect from.
class StreamClosed extends Error {}

/**
 * Follows the order by `GET /purchases/:id/stream` (SPEC-008 §7), with fetch streaming because
 * EventSource cannot send the bearer token. A dropped connection reconnects; the stream ending
 * after a final stage or the timeout, an aborted signal or a refused request settle the promise.
 */
export async function followPurchase(
  token: string,
  purchaseId: string,
  handlers: PurchaseStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const { fetchEventSource } = await import("@microsoft/fetch-event-source");
  try {
    await fetchEventSource(
      `${publicEnv.apiUrl}/purchases/${encodeURIComponent(purchaseId)}/stream`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal,
        openWhenHidden: true,
        async onopen(response) {
          if (!response.ok) {
            throw new ApiError(response.status, `http_${response.status}`, "Stream refused.", null);
          }
        },
        onmessage(message) {
          if (message.event === "status") {
            const data = JSON.parse(message.data) as { stage: PurchaseStage };
            handlers.onStage(data.stage);
          } else if (message.event === "timeout") {
            handlers.onTimeout();
          }
        },
        onclose() {
          throw new StreamClosed();
        },
        onerror(error) {
          if (error instanceof StreamClosed || error instanceof ApiError) {
            throw error;
          }
          // A dropped connection: fetch-event-source tries again.
          return undefined;
        },
      },
    );
  } catch (error) {
    if (!(error instanceof StreamClosed)) {
      throw error;
    }
  }
}
