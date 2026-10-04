import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { AccountActivationController } from "./account-activation.controller";
import { AccountActivationRepository } from "./account-activation.repository";
import { AccountActivationService } from "./account-activation.service";

@Module({
  imports: [UsersModule],
  controllers: [AccountActivationController],
  providers: [AccountActivationRepository, AccountActivationService],
})
export class AccountsModule {}
