import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { HealthService } from "./health.service";
import { type LivenessResponse, type ReadinessResponse } from "./health.types";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  liveness(): LivenessResponse {
    return this.healthService.liveness();
  }

  @Get("ready")
  async readiness(): Promise<ReadinessResponse> {
    const result = await this.healthService.readiness();

    if (result.status === "not_ready") {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
