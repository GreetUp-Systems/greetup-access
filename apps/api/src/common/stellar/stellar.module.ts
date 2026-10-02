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
              trustlines: [
                { code: config.stellarAssetCode, issuer: config.stellarAssetIssuer },
                { code: "USDC", issuer: config.stellarUsdcAssetIssuer },
              ],
              sponsorPublicKey: config.stellarSponsorPublicKey,
              sponsorSecretKey: config.stellarSponsorSecretKey,
            });
          },
        },
        {
          provide: STELLAR_ACTIVATION_CONFIG,
          useValue: {
            stellarNetwork: config.stellarNetwork,
          },
        },
      ],
      exports: [STELLAR_GATEWAY, STELLAR_ACTIVATION_CONFIG],
    };
  }
}
