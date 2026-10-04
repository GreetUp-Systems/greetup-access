import { type ApiConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { TicketQrService } from "./ticket-qr.service";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";
import { TICKETS_CONFIG, type TicketsConfig } from "./tickets.types";

@Module({})
export class TicketsModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: TicketsModule,
      imports: [UsersModule],
      controllers: [TicketsController],
      providers: [
        TicketsRepository,
        TicketsService,
        TicketQrService,
        {
          provide: TICKETS_CONFIG,
          useValue: {
            qrSecret: config.ticketQrSecret,
            stellarNetwork: config.stellarNetwork,
            ticketContractId: config.stellarTicketContractId,
          } satisfies TicketsConfig,
        },
      ],
    };
  }
}
