import type { PublicEvent, PublicTicketType } from "./api/events";

/** An order is 1 to 10 tickets of one type (SPEC-005). */
export const MAX_TICKETS_PER_ORDER = 10;

export type SaleState = "on_sale" | "cancelled" | "started";

/** Only a published event that has not started sells (SPEC-014 §8). */
export function saleState(event: Pick<PublicEvent, "status" | "startsAt">, now: Date): SaleState {
  if (event.status === "cancelled") {
    return "cancelled";
  }
  return new Date(event.startsAt).getTime() <= now.getTime() ? "started" : "on_sale";
}

/** "A partir de": the cheapest ticket still available, or the cheapest of all when none is. */
export function startingPrice(types: readonly PublicTicketType[]): number | null {
  const pool = types.some((type) => type.available > 0)
    ? types.filter((type) => type.available > 0)
    : types;
  return pool.length === 0 ? null : Math.min(...pool.map((type) => type.priceCents));
}

/** The first type that can be bought, chosen when the sheet opens. */
export function defaultTicketType(types: readonly PublicTicketType[]): PublicTicketType | null {
  return types.find((type) => type.available > 0) ?? null;
}

/** The counter never goes past what is available nor past 10 (SPEC-014 §8). */
export function maxQuantity(type: PublicTicketType | null): number {
  return type === null ? 0 : Math.max(0, Math.min(MAX_TICKETS_PER_ORDER, type.available));
}

export function clampQuantity(quantity: number, type: PublicTicketType | null): number {
  const max = maxQuantity(type);
  return max === 0 ? 0 : Math.min(Math.max(1, quantity), max);
}
