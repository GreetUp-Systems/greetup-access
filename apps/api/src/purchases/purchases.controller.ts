import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
} from "@nestjs/common";
import { type Observable } from "rxjs";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PurchaseStreamService } from "./purchase-stream.service";
import { PurchasesService } from "./purchases.service";
import { type PurchaseView } from "./purchases.types";

@Controller("purchases")
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly purchaseStream: PurchaseStreamService,
  ) {}

  @Post()
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<PurchaseView> {
    return this.purchasesService.create(principal, body, idempotencyKey);
  }

  @Get(":id")
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", new ParseUUIDPipe({ version: "4" })) purchaseId: string,
  ): Promise<PurchaseView> {
    return this.purchasesService.get(principal, purchaseId);
  }

  @Post(":id/pix")
  @HttpCode(HttpStatus.OK)
  generatePix(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", new ParseUUIDPipe({ version: "4" })) purchaseId: string,
    @Body() body: unknown,
  ): Promise<PurchaseView> {
    return this.purchasesService.generatePix(principal, purchaseId, body);
  }

  @Sse(":id/stream")
  stream(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id", new ParseUUIDPipe({ version: "4" })) purchaseId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.purchaseStream.open(principal, purchaseId);
  }
}
