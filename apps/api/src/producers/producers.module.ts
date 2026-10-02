import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { ProducerOnboardingController } from "./producer-onboarding.controller";
import { ProducerOnboardingRepository } from "./producer-onboarding.repository";
import { ProducerOnboardingService } from "./producer-onboarding.service";
import { ProducersController } from "./producers.controller";
import { ProducersRepository } from "./producers.repository";
import { ProducersService } from "./producers.service";

@Module({
  imports: [UsersModule],
  controllers: [ProducersController, ProducerOnboardingController],
  providers: [
    ProducersRepository,
    ProducersService,
    ProducerOnboardingRepository,
    ProducerOnboardingService,
  ],
})
export class ProducersModule {}
