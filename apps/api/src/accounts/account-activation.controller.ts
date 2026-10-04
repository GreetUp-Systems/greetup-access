import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { type AccountActivationView, AccountActivationService } from "./account-activation.service";

@Controller("me/stellar")
export class AccountActivationController {
  constructor(private readonly activation: AccountActivationService) {}

  @Post("activate")
  @HttpCode(HttpStatus.OK)
  activate(@CurrentUser() principal: AuthenticatedPrincipal): Promise<AccountActivationView> {
    return this.activation.activate(principal);
  }
}
