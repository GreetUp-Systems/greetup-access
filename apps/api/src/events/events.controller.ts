import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { EventsService } from "./events.service";
import { type EventSummaryView, type EventView, type TicketTypeView } from "./events.types";

const uuid = new ParseUUIDPipe({ version: "4" });

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<EventView> {
    return this.eventsService.create(principal, body);
  }

  @Get()
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<EventSummaryView[]> {
    return this.eventsService.list(principal, query);
  }

  @Get(":id")
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
  ): Promise<EventView> {
    return this.eventsService.get(principal, eventId);
  }

  @Patch(":id")
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
    @Body() body: unknown,
  ): Promise<EventView> {
    return this.eventsService.update(principal, eventId, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
  ): Promise<void> {
    return this.eventsService.remove(principal, eventId);
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
  ): Promise<EventView> {
    return this.eventsService.publish(principal, eventId);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
  ): Promise<EventView> {
    return this.eventsService.cancel(principal, eventId);
  }

  @Post(":id/ticket-types")
  createTicketType(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
    @Body() body: unknown,
  ): Promise<TicketTypeView> {
    return this.eventsService.createTicketType(principal, eventId, body);
  }

  @Patch(":id/ticket-types/:ticketTypeId")
  updateTicketType(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
    @Param("ticketTypeId", uuid) ticketTypeId: string,
    @Body() body: unknown,
  ): Promise<TicketTypeView> {
    return this.eventsService.updateTicketType(principal, eventId, ticketTypeId, body);
  }

  @Delete(":id/ticket-types/:ticketTypeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTicketType(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", uuid) eventId: string,
    @Param("ticketTypeId", uuid) ticketTypeId: string,
  ): Promise<void> {
    return this.eventsService.removeTicketType(principal, eventId, ticketTypeId);
  }
}
