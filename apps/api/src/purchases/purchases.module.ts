import { type ApiConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { PurchasesController } from "./purchases.controller";
import { PurchasesRepository } from "./purchases.repository";
import { PurchasesService } from "./purchases.service";
import { PURCHASE_CHECKOUT_CONFIG } from "./purchases.types";

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
        {
          provide: PURCHASE_CHECKOUT_CONFIG,
          // BlindPay settles in the configured asset: USDB on Testnet (SPEC-003 §12).
          useValue: { token: config.stellarAssetCode, partnerFeeId: config.blindPayPartnerFeeId },
        },
      ],
    };
  }
}
