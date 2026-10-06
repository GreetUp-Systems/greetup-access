import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { type AccountActivationView, AccountActivationService } from "./account-activation.service";

@Controller("me/stellar")
export class AccountActivationController {
  constructor(private readonly activation: AccountActivationService) {}

  /** Prepares the activation; when it needs the user, answers the hash to sign (D-28). */
  @Post("activate")
  @HttpCode(HttpStatus.OK)
  activate(@CurrentUser() principal: AuthenticatedPrincipal): Promise<AccountActivationView> {
    return this.activation.activate(principal);
  }

  /** The browser's signature of the prepared hash, submitted with the sponsor's. */
  @Post("activate/signature")
  @HttpCode(HttpStatus.OK)
  submitSignature(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<AccountActivationView> {
    return this.activation.submitSignature(principal, body);
  }
}
