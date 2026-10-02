import { type ApiConfig } from "@access/config";
import { DynamicModule, Global, Module } from "@nestjs/common";

import { BlindPayWebhookPrismaService } from "./blindpay-webhook-prisma.service";
import { BlindPayWebhookController } from "./blindpay-webhook.controller";
import { BlindPayWebhookService } from "./blindpay-webhook.service";
import { BlindPayWebhookVerifier } from "./blindpay-webhook.verifier";
import { BlindPayHttpGateway } from "./blindpay.gateway";
import {
  BLINDPAY_ALLOWED_REDIRECT_ORIGINS,
  BLINDPAY_GATEWAY,
  BLINDPAY_WEBHOOK_SECRET,
} from "./blindpay.types";

@Global()
@Module({})
export class BlindPayModule {
  static forRoot(config: ApiConfig): DynamicModule {
    const sharedProviders = [
      {
        provide: BLINDPAY_GATEWAY,
        useFactory: () =>
          new BlindPayHttpGateway({
            apiKey: config.blindPayApiKey,
            instanceId: config.blindPayInstanceId,
            baseUrl: config.blindPayBaseUrl,
            timeoutMs: config.blindPayApiTimeoutMs,
          }),
      },
      {
        provide: BLINDPAY_ALLOWED_REDIRECT_ORIGINS,
        useValue: config.blindPayAllowedRedirectOrigins,
      },
    ];
    const webhookDatabaseUrl = config.databaseBlindPayWebhookUrl;
    const webhookSecret = config.blindPayWebhookSecret;

    if (webhookDatabaseUrl === undefined || webhookSecret === undefined) {
      return {
        module: BlindPayModule,
        providers: sharedProviders,
        exports: [BLINDPAY_GATEWAY, BLINDPAY_ALLOWED_REDIRECT_ORIGINS],
      };
    }

    return {
      module: BlindPayModule,
      controllers: [BlindPayWebhookController],
      providers: [
        ...sharedProviders,
        {
          provide: BlindPayWebhookPrismaService,
          useFactory: () => new BlindPayWebhookPrismaService(webhookDatabaseUrl),
        },
        {
          provide: BLINDPAY_WEBHOOK_SECRET,
          useValue: webhookSecret,
        },
        BlindPayWebhookVerifier,
        BlindPayWebhookService,
      ],
      exports: [BLINDPAY_GATEWAY, BLINDPAY_ALLOWED_REDIRECT_ORIGINS],
    };
  }
}
