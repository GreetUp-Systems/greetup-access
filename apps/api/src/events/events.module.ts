import { type ApiConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { CitiesModule } from "../cities/cities.module";
import { UsersModule } from "../users/users.module";
import { EventsController } from "./events.controller";
import { EventsRepository } from "./events.repository";
import { EventsService } from "./events.service";
import { TICKET_PRICING, type TicketPricing } from "./events.types";
import { PublicEventsController } from "./public-events.controller";

@Module({})
export class EventsModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: EventsModule,
      imports: [UsersModule, CitiesModule],
      controllers: [EventsController, PublicEventsController],
      providers: [
        EventsRepository,
        EventsService,
        {
          provide: TICKET_PRICING,
          useValue: { minPriceCents: config.ticketMinPriceCents } satisfies TicketPricing,
        },
      ],
    };
  }
}
