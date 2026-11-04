import { formatPrice } from "../format";

// A price in reais as the producer types it, and in cents as the API takes it (SPEC-004 §8).

/** The API's integers: the largest price a ticket type may have, in cents. */
const MAX_CENTS = 2_147_483_647;

/**
 * "R$ 1.200,50", "1200,5", "60" or "60.5" as cents (120050, 120050, 6000, 6050); null when it is
 * not an amount, or has more than two decimals. The comma is the decimal separator; a dot is one
 * too when no comma comes and one or two digits follow it.
 */
export function parseReais(value: string): number | null {
  const text = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (text === "") {
    return null;
  }
  let whole: string;
  let fraction = "";
  const comma = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/.exec(text);
  const dot = /^(\d+)\.(\d{1,2})$/.exec(text);
  if (comma !== null) {
    whole = comma[1]!.replace(/\./g, "");
    fraction = comma[2]!;
  } else if (dot !== null) {
    whole = dot[1]!;
    fraction = dot[2]!;
  } else if (/^(\d{1,3}(?:\.\d{3})+|\d+),?$/.test(text)) {
    whole = text.replace(/[.,]/g, "");
  } else {
    return null;
  }
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/** 6000 → "R$ 60,00": how the price field shows a price once it is left. */
export function formatReais(cents: number): string {
  return formatPrice(cents);
}
