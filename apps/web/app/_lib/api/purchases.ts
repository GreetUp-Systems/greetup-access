import { apiRequest } from "./client";

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
