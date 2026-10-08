import { type Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

import { salesTimeZone } from "./producer-sales.types";

/** A sale is a purchase whose payment was confirmed, with or without its tickets issued yet. */
export const soldPurchaseStatuses = ["PAYMENT_CONFIRMED", "TICKET_ISSUED"] as const;

export interface DailySalesRecord {
  day: string;
  tickets: number;
  salesCents: number;
}

const recentSaleSelect = {
  quantity: true,
  subtotalCents: true,
  paymentConfirmedAt: true,
  event: { select: { name: true } },
  ticketType: { select: { name: true } },
} satisfies Prisma.PurchaseSelect;

export type RecentSaleRecord = Prisma.PurchaseGetPayload<{ select: typeof recentSaleSelect }>;

/**
 * Producer reads under `purchases_producer_read`. Every query also filters by the producer:
 * in this context the same user may see purchases of their own as a buyer.
 */
@Injectable()
export class ProducerSalesRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  /** Tickets and subtotals per day of confirmation in Brasília time, from `from` to `to`. */
  dailySales(userId: string, from: string, to: string): Promise<DailySalesRecord[]> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const rows = await transaction.$queryRaw<
        Array<{ day: string; tickets: bigint; sales_cents: bigint }>
      >`
        SELECT to_char("local_day", 'YYYY-MM-DD') AS "day",
          SUM("quantity") AS "tickets",
          SUM("subtotal_cents") AS "sales_cents"
        FROM (
          SELECT (("payment_confirmed_at" AT TIME ZONE 'UTC') AT TIME ZONE ${salesTimeZone})::date
              AS "local_day",
            "quantity",
            "subtotal_cents"
          FROM "purchases"
          WHERE "producer_id" = ${producerId}::uuid
            AND "status" IN ('payment_confirmed', 'ticket_issued')
            AND "payment_confirmed_at" IS NOT NULL
        ) AS "confirmed"
        WHERE "local_day" BETWEEN ${from}::date AND ${to}::date
        GROUP BY "local_day"
      `;
      return rows.map((row) => ({
        day: row.day,
        tickets: Number(row.tickets),
        salesCents: Number(row.sales_cents),
      }));
    });
  }

  recentSales(userId: string, limit: number): Promise<RecentSaleRecord[]> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.purchase.findMany({
        where: {
          producerId,
          status: { in: [...soldPurchaseStatuses] },
          paymentConfirmedAt: { not: null },
        },
        select: recentSaleSelect,
        orderBy: [{ paymentConfirmedAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    );
  }
}
