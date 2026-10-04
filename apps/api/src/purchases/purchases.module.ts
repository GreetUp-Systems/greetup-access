import { type ApiConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { PurchaseStreamService } from "./purchase-stream.service";
import { PurchasesController } from "./purchases.controller";
import { PurchasesRepository } from "./purchases.repository";
import { PurchasesService } from "./purchases.service";
import {
  PURCHASE_CHECKOUT_CONFIG,
  PURCHASE_STREAM_TIMING,
  type PurchaseStreamTiming,
} from "./purchases.types";

@Module({})
export class PurchasesModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: PurchasesModule,
      imports: [UsersModule],
      controllers: [PurchasesController],
      providers: [
        PurchasesRepository,
        PurchasesService,
        PurchaseStreamService,
        {
          provide: PURCHASE_STREAM_TIMING,
          useValue: {
            pollMs: 2_000,
            heartbeatMs: 15_000,
            timeoutMs: 15 * 60 * 1_000,
          } satisfies PurchaseStreamTiming,
        },
        {
          provide: PURCHASE_CHECKOUT_CONFIG,
          // BlindPay settles in the configured asset: USDB on Testnet (SPEC-003 §12).
          useValue: { token: config.stellarAssetCode, partnerFeeId: config.blindPayPartnerFeeId },
        },
      ],
    };
  }
}
