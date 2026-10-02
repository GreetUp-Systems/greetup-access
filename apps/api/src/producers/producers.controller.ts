import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducersService } from "./producers.service";
import { type ProducerProfileView } from "./producers.types";

@Controller("producers")
export class ProducersController {
  constructor(private readonly producersService: ProducersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<ProducerProfileView> {
    return this.producersService.create(principal, body);
  }

  @Get("me")
  me(@CurrentUser() principal: AuthenticatedPrincipal): Promise<ProducerProfileView> {
    return this.producersService.me(principal);
  }
}
