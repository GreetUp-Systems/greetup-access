import { type ApiConfig } from "@access/config";
import { PrismaModule } from "@access/database";
import { RedisModule } from "@access/redis";
import { DynamicModule, Module } from "@nestjs/common";

import { AccountsModule } from "./accounts/accounts.module";
import { AuthModule } from "./auth/auth.module";
import { BlindPayModule } from "./common/blindpay/blindpay.module";
import { PrivyModule } from "./common/privy/privy.module";
import { StellarModule } from "./common/stellar/stellar.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { ProducersModule } from "./producers/producers.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { TicketsModule } from "./tickets/tickets.module";

@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PrismaModule.forRoot(config.databaseUrl, { requireRestrictedRole: true }),
        RedisModule.forRoot(config.redisUrl),
        BlindPayModule.forRoot(config),
        PrivyModule.forRoot(config),
        StellarModule.forRoot(config),
        AuthModule,
        AccountsModule,
        ProducersModule,
        EventsModule.forRoot(config),
        PurchasesModule.forRoot(config),
        TicketsModule.forRoot(config),
        HealthModule.forRoot(config.healthCheckTimeoutMs),
      ],
    };
  }
}
