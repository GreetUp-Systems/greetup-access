import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerOnboardingService } from "./producer-onboarding.service";
import {
  ProducerStellarActivationService,
  type StellarActivationView,
} from "./producer-stellar-activation.service";
import {
  type CreatedCustomerView,
  type OpenRfiView,
  type TermsSessionView,
  type UploadedDocumentView,
  type UploadedFileInput,
} from "./producer-onboarding.types";

@Controller("producers/onboarding")
export class ProducerOnboardingController {
  constructor(
    private readonly onboardingService: ProducerOnboardingService,
    private readonly stellarActivation: ProducerStellarActivationService,
  ) {}

  @Post("stellar/activate")
  @HttpCode(HttpStatus.OK)
  activateStellar(
    @CurrentUser() principal: AuthenticatedPrincipal,
  ): Promise<StellarActivationView> {
    return this.stellarActivation.activate(principal);
  }

  /** The browser's signature of the prepared hash, submitted with the sponsor's (D-28). */
  @Post("stellar/activate/signature")
  @HttpCode(HttpStatus.OK)
  submitStellarSignature(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<StellarActivationView> {
    return this.stellarActivation.submitSignature(principal, body);
  }

  @Post("tos")
  @HttpCode(HttpStatus.OK)
  createTermsSession(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<TermsSessionView> {
    return this.onboardingService.createTermsSession(principal, body);
  }

  @Post("files")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UploadedDocumentView> {
    return this.onboardingService.uploadDocument(principal, file, idempotencyKey);
  }

  @Post("customer")
  @HttpCode(HttpStatus.OK)
  createCustomer(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Ip() requestIp: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreatedCustomerView> {
    return this.onboardingService.createCustomer(principal, body, requestIp, idempotencyKey);
  }

  @Get("rfi")
  getOpenRfi(@CurrentUser() principal: AuthenticatedPrincipal): Promise<OpenRfiView> {
    return this.onboardingService.getOpenRfi(principal);
  }

  @Post("rfi")
  @HttpCode(HttpStatus.NO_CONTENT)
  submitRfi(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<void> {
    return this.onboardingService.submitRfi(principal, body, idempotencyKey);
  }
}
