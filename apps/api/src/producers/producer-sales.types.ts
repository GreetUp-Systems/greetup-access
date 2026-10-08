/** Sales are counted on the day of the payment confirmation, in Brasília time (SPEC-015 §8). */
export const salesTimeZone = "America/Sao_Paulo";

export const salesPeriodDays = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type SalesPeriod = keyof typeof salesPeriodDays;

export interface SalesTotals {
  tickets: number;
  salesCents: number;
}

export interface DailySalesView extends SalesTotals {
  /** YYYY-MM-DD in Brasília time. */
  date: string;
}

export interface SalesSummaryView extends SalesTotals {
  period: SalesPeriod;
  /** The period of the same length right before this one. */
  previous: SalesTotals;
  /** Every day of the period, oldest first, zero when nothing sold. */
  daily: DailySalesView[];
}

/** A confirmed sale, without anything about who bought it (RN-010). */
export interface RecentSaleView {
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  subtotalCents: number;
  confirmedAt: string;
}

export const recentSalesDefaultLimit = 5;
export const recentSalesMaxLimit = 20;

/** Calendar date of an instant in Brasília time. */
export function salesDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: salesTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** `count` calendar days ending at `lastDay`, oldest first. */
export function calendarDays(lastDay: string, count: number): string[] {
  const last = Date.parse(`${lastDay}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(last - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}
