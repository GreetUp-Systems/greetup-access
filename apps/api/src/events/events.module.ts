import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { EventsController } from "./events.controller";
import { EventsRepository } from "./events.repository";
import { EventsService } from "./events.service";
import { PublicEventsController } from "./public-events.controller";

@Module({
  imports: [UsersModule],
  controllers: [EventsController, PublicEventsController],
  providers: [EventsRepository, EventsService],
})
export class EventsModule {}
