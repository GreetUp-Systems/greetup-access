import { type ApiConfig } from "@access/config";
import { DynamicModule, Global, Module } from "@nestjs/common";

import { PrivySdkGateway } from "./privy.gateway";
import { PRIVY_GATEWAY } from "./privy.types";

@Global()
@Module({})
export class PrivyModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: PrivyModule,
      providers: [
        {
          provide: PRIVY_GATEWAY,
          useFactory: () =>
            new PrivySdkGateway({
              appId: config.privyAppId,
              appSecret: config.privyAppSecret,
              jwtVerificationKey: config.privyJwtVerificationKey,
              timeoutMs: config.privyApiTimeoutMs,
            }),
        },
      ],
      exports: [PRIVY_GATEWAY],
    };
  }
}
