import { type ApiConfig } from "@access/config";
import { DynamicModule, Global, Module } from "@nestjs/common";

import { StellarHorizonGateway } from "./stellar.gateway";
import { STELLAR_ACTIVATION_CONFIG, STELLAR_GATEWAY } from "./stellar.types";

@Global()
@Module({})
export class StellarModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: StellarModule,
      providers: [
        {
          provide: STELLAR_GATEWAY,
          useFactory: () => {
            if (config.nodeEnv === "production" || config.stellarSponsorSecretKey === undefined) {
              throw new Error("The local Stellar signer is disabled in production.");
            }

            return new StellarHorizonGateway({
              horizonUrl: config.stellarHorizonUrl,
              assetCode: config.stellarAssetCode,
              assetIssuer: config.stellarAssetIssuer,
              sponsorPublicKey: config.stellarSponsorPublicKey,
              sponsorSecretKey: config.stellarSponsorSecretKey,
            });
          },
        },
        {
          provide: STELLAR_ACTIVATION_CONFIG,
          useValue: {
            stellarNetwork: config.stellarNetwork,
            stellarAssetCode: config.stellarAssetCode,
            stellarAssetIssuer: config.stellarAssetIssuer,
          },
        },
      ],
      exports: [STELLAR_GATEWAY, STELLAR_ACTIVATION_CONFIG],
    };
  }
}
