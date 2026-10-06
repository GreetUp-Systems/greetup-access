import { ApiError } from "./api/client";
import { type PurchaseView } from "./api/purchases";

/**
 * Why the order could not be created, as the chooser shows it (SPEC-014 §6 and §7): Valor mínimo,
 * Valor máximo, Esgotou na escolha, the event page's closed sales, or Falha ao continuar.
 */
export type CreationNotice =
  "below_minimum" | "above_maximum" | "sold_out" | "event_closed" | "failed";

export function creationNotice(error: unknown): CreationNotice {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "purchase_below_minimum":
        return "below_minimum";
      case "purchase_above_maximum":
        return "above_maximum";
      case "ticket_type_sold_out":
        return "sold_out";
      case "event_not_on_sale":
        return "event_closed";
    }
  }
  return "failed";
}

/**
 * What "Gerar Pix" leads to when the API refuses it (SPEC-014 §7): Total mudou, Erro de conexão,
 * an expired reservation (recreated by the app), Pagamento não concluído, or back to the chooser
 * with its Pix range notice.
 */
export type PixNotice =
  "total_changed" | "connection" | "expired" | "not_completed" | "below_minimum" | "above_maximum";

export function pixNotice(error: unknown): PixNotice {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "purchase_total_changed":
        return "total_changed";
      case "purchase_expired":
        return "expired";
      case "payment_rejected":
      case "purchase_not_payable":
        return "not_completed";
      case "purchase_below_minimum":
        return "below_minimum";
      case "purchase_above_maximum":
        return "above_maximum";
    }
  }
  // No answer, the provider unavailable or an unexpected refusal: trying again is safe, since
  // the API answers the same purchase and never creates a second Pix.
  return "connection";
}

/** The purchase with the new total that comes with `purchase_total_changed`. */
export function changedPurchase(error: unknown): PurchaseView | null {
  if (!(error instanceof ApiError) || error.code !== "purchase_total_changed") {
    return null;
  }
  const body = error.body;
  if (typeof body !== "object" || body === null || !("purchase" in body)) {
    return null;
  }
  return (body as { purchase: PurchaseView }).purchase;
}

/** "Festival de Inverno · 2 × Pista", the order in one line. */
export function orderDescription(purchase: PurchaseView): string {
  return `${purchase.event.name} · ${purchase.quantity} × ${purchase.ticketType.name}`;
}

// The follow-up's texts in singular or plural (Figma: Pagamento confirmado 146:2411 / 150:2645,
// Ingresso pronto 146:2500 / 150:2755).

/** "Estamos emitindo seus 2 ingressos." */
export function issuingLead(quantity: number): string {
  return quantity === 1
    ? "Estamos emitindo seu ingresso."
    : `Estamos emitindo seus ${quantity} ingressos.`;
}

/** "Emitindo seus 2 ingressos", the desktop's second step. */
export function issuingStep(quantity: number): string {
  return quantity === 1 ? "Emitindo seu ingresso" : `Emitindo seus ${quantity} ingressos`;
}

/** "Os 2 ingressos estão na sua conta." */
export function readyLead(quantity: number): string {
  return quantity === 1
    ? "O ingresso está na sua conta."
    : `Os ${quantity} ingressos estão na sua conta.`;
}
