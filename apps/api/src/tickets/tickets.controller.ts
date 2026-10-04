import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";
import { type TicketDetailView, type TicketListView } from "./tickets.types";

@Controller("me/tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  list(@CurrentUser() principal: AuthenticatedPrincipal): Promise<TicketListView> {
    return this.ticketsService.list(principal);
  }

  @Get(":id")
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", new ParseUUIDPipe({ version: "4" })) ticketId: string,
  ): Promise<TicketDetailView> {
    return this.ticketsService.get(principal, ticketId);
  }
}
