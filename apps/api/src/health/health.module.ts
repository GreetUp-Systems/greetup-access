import { DynamicModule, Module } from "@nestjs/common";

import { HEALTH_CHECK_TIMEOUT_MS } from "./health.constants";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({})
export class HealthModule {
  static forRoot(timeoutMs: number): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_CHECK_TIMEOUT_MS,
          useValue: timeoutMs,
        },
        HealthService,
      ],
    };
  }
}
