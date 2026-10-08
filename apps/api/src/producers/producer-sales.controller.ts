import { Controller, Get, Query } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerSalesService } from "./producer-sales.service";
import { type RecentSaleView, type SalesSummaryView } from "./producer-sales.types";

@Controller("producers/me/sales")
export class ProducerSalesController {
  constructor(private readonly salesService: ProducerSalesService) {}

  @Get()
  summary(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<SalesSummaryView> {
    return this.salesService.summary(principal, query);
  }

  @Get("recent")
  recent(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<RecentSaleView[]> {
    return this.salesService.recent(principal, query);
  }
}
