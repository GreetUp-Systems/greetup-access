export type PurchaseStatusView =
  | "initiated"
  | "awaiting_payment"
  | "payment_confirmed"
  | "ticket_issued"
  | "payment_failed"
  | "payment_refunded";

export interface PurchaseTicketView {
  id: string;
  status: "pending_mint" | "issued";
  tokenId: number | null;
}

/** The buyer sees a single service fee; its composition stays in the database (SPEC-005 §5). */
export interface PurchaseView {
  id: string;
  status: PurchaseStatusView;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  serviceFeeCents: number | null;
  totalCents: number | null;
  pixCode: string | null;
  createdAt: string;
  tickets: PurchaseTicketView[];
}

export interface PurchaseCheckoutConfig {
  token: string;
  partnerFeeId: string | undefined;
}

export const PURCHASE_CHECKOUT_CONFIG = Symbol("PURCHASE_CHECKOUT_CONFIG");
