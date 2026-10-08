import { ProducerContextNotFoundError } from "@access/database";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { z, type ZodType, type ZodTypeDef } from "zod";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { UsersRepository } from "../users/users.repository";
import { ProducerSalesRepository } from "./producer-sales.repository";
import {
  calendarDays,
  type RecentSaleView,
  recentSalesDefaultLimit,
  recentSalesMaxLimit,
  salesDate,
  salesPeriodDays,
  type SalesSummaryView,
  type SalesTotals,
} from "./producer-sales.types";

const summaryQuerySchema = z
  .object({ period: z.enum(Object.keys(salesPeriodDays) as [keyof typeof salesPeriodDays]) })
  .strict();

const recentQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d{1,3}$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(recentSalesMaxLimit))
      .optional(),
  })
  .strict();

@Injectable()
export class ProducerSalesService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sales: ProducerSalesRepository,
  ) {}

  async summary(principal: AuthenticatedPrincipal, query: unknown): Promise<SalesSummaryView> {
    const { period } = this.parse(summaryQuerySchema, query);
    const userId = await this.requireUserId(principal);
    const days = salesPeriodDays[period];
    const range = calendarDays(salesDate(new Date()), days * 2);
    const rows = await this.mapErrors(() =>
      this.sales.dailySales(userId, range[0]!, range[range.length - 1]!),
    );
    const byDay = new Map(rows.map((row) => [row.day, row]));
    const totalsOf = (dates: string[]): SalesTotals =>
      dates.reduce(
        (totals, date) => ({
          tickets: totals.tickets + (byDay.get(date)?.tickets ?? 0),
          salesCents: totals.salesCents + (byDay.get(date)?.salesCents ?? 0),
        }),
        { tickets: 0, salesCents: 0 },
      );

    const current = range.slice(days);
    return {
      period,
      ...totalsOf(current),
      previous: totalsOf(range.slice(0, days)),
      daily: current.map((date) => ({ date, ...totalsOf([date]) })),
    };
  }

  async recent(principal: AuthenticatedPrincipal, query: unknown): Promise<RecentSaleView[]> {
    const { limit } = this.parse(recentQuerySchema, query);
    const userId = await this.requireUserId(principal);
    const sales = await this.mapErrors(() =>
      this.sales.recentSales(userId, limit ?? recentSalesDefaultLimit),
    );
    return sales.map((sale) => ({
      eventName: sale.event.name,
      ticketTypeName: sale.ticketType.name,
      quantity: sale.quantity,
      subtotalCents: sale.subtotalCents,
      confirmedAt: sale.paymentConfirmedAt!.toISOString(),
    }));
  }

  private parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, query: unknown): T {
    const result = schema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException({
        code: "invalid_sales_query",
        message: "The query is invalid.",
        fields: [...new Set(result.error.issues.map((issue) => issue.path.join(".")))],
      });
    }
    return result.data;
  }

  private async requireUserId(principal: AuthenticatedPrincipal): Promise<string> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    return user.id;
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ProducerContextNotFoundError) {
        throw new NotFoundException({
          code: "producer_not_found",
          message: "The authenticated account does not have a producer profile.",
        });
      }
      throw error;
    }
  }
}
