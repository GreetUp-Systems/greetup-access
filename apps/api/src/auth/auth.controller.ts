import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { type AccountView } from "../users/users.types";
import { AuthService } from "./auth.service";
import { type AuthenticatedPrincipal } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("auth/bootstrap")
  @HttpCode(HttpStatus.OK)
  bootstrap(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<AccountView> {
    return this.authService.bootstrap(principal, body);
  }

  @Get("me")
  me(@CurrentUser() principal: AuthenticatedPrincipal): Promise<AccountView> {
    return this.authService.me(principal);
  }
}
