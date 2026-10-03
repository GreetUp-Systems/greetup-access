import { Controller, Get, Param } from "@nestjs/common";

import { Public } from "../auth/decorators/public.decorator";
import { EventsService } from "./events.service";
import { type PublicEventView } from "./events.types";

@Public()
@Controller("public/events")
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(":slug")
  find(@Param("slug") slug: string): Promise<PublicEventView> {
    return this.eventsService.findPublic(slug);
  }
}
