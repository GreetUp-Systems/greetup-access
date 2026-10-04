import { type WorkerConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";
import { Networks } from "@stellar/stellar-sdk";

import {
  SorobanTicketContractGateway,
  TICKET_CONTRACT_GATEWAY,
} from "../chain/ticket-contract.gateway";
import { MintTicketWorker } from "./mint-ticket.worker";
import { MintTicketsRepository } from "./mint-tickets.repository";
import { MintTicketsService } from "./mint-tickets.service";

@Module({})
export class TicketsModule {
  static forRoot(config: WorkerConfig): DynamicModule {
    return {
      module: TicketsModule,
      providers: [
        {
          provide: TICKET_CONTRACT_GATEWAY,
          useFactory: () => {
            // The configuration already forbids the local signer in production (ADR-010).
            if (config.stellarSponsorSecretKey === undefined) {
              throw new Error("The local Stellar signer is required to mint tickets.");
            }
            return new SorobanTicketContractGateway({
              contractId: config.stellarTicketContractId,
              rpcUrl: config.stellarRpcUrl,
              networkPassphrase: Networks.TESTNET,
              signerSecretKey: config.stellarSponsorSecretKey,
            });
          },
        },
        MintTicketsRepository,
        MintTicketsService,
        {
          provide: MintTicketWorker,
          useFactory: (service: MintTicketsService) =>
            new MintTicketWorker(config.redisUrl, service),
          inject: [MintTicketsService],
        },
      ],
    };
  }
}
