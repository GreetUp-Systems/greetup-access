import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@access/database";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import {
  BLINDPAY_ALLOWED_REDIRECT_ORIGINS,
  BLINDPAY_GATEWAY,
  type BlindPayGateway,
  type BlindPayKycStatusValue,
  type BlindPayProviderError,
  type BlindPayRfi,
  type BlindPayRfiAnswers,
} from "../common/blindpay/blindpay.types";
import { UsersRepository } from "../users/users.repository";
import {
  idempotencyKeySchema,
  type CreateBlindPayCustomerInput,
  createBlindPayCustomerSchema,
  termsRequestSchema,
} from "./producer-onboarding.schemas";
import {
  type BlindPayCustomerRecord,
  CustomerAttemptAlreadyActiveError,
  ProducerOnboardingRepository,
} from "./producer-onboarding.repository";
import {
  type CreatedCustomerView,
  type OpenRfiView,
  type TermsSessionView,
  type UploadedDocumentView,
  type UploadedFileInput,
} from "./producer-onboarding.types";
import { ProducersRepository, type ProducerProfileRecord } from "./producers.repository";

const acceptedUploadTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxUploadBytes = 10 * 1024 * 1024;
const storedKycStatus = {
  verifying: "VERIFYING",
  approved: "APPROVED",
  rejected: "REJECTED",
  compliance_request: "COMPLIANCE_REQUEST",
  approved_rfi: "APPROVED_RFI",
} as const satisfies Record<BlindPayKycStatusValue, string>;

@Injectable()
export class ProducerOnboardingService {
  private readonly logger = new Logger(ProducerOnboardingService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly producers: ProducersRepository,
    private readonly onboarding: ProducerOnboardingRepository,
    @Inject(BLINDPAY_GATEWAY) private readonly blindPay: BlindPayGateway,
    @Inject(BLINDPAY_ALLOWED_REDIRECT_ORIGINS)
    private readonly allowedRedirectOrigins: string[],
  ) {}

  async createTermsSession(
    principal: AuthenticatedPrincipal,
    input: unknown,
  ): Promise<TermsSessionView> {
    await this.requireProducer(principal);
    const parsed = termsRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw this.invalidOnboardingInput();
    }

    const redirectUrl = new URL(parsed.data.redirectUrl);
    if (!this.allowedRedirectOrigins.includes(redirectUrl.origin)) {
      throw new BadRequestException({
        code: "redirect_origin_not_allowed",
        message: "The redirect URL origin is not allowed.",
      });
    }

    try {
      return await this.blindPay.createTermsOfServiceUrl({
        idempotencyKey: randomUUID(),
        redirectUrl: redirectUrl.toString(),
      });
    } catch (error) {
      throw this.mapProviderError(error, "terms_session_failed");
    }
  }

  async uploadDocument(
    principal: AuthenticatedPrincipal,
    file: UploadedFileInput | undefined,
    clientIdempotencyKey: string | undefined,
  ): Promise<UploadedDocumentView> {
    const { producer } = await this.requireProducer(principal);
    const idempotencyKey = this.parseIdempotencyKey(clientIdempotencyKey);

    if (
      file === undefined ||
      file.size === 0 ||
      file.size > maxUploadBytes ||
      !acceptedUploadTypes.has(file.mimetype) ||
      file.buffer.length !== file.size
    ) {
      throw new BadRequestException({
        code: "invalid_onboarding_file",
        message: "The file must be a PDF, JPEG or PNG up to 10 MB.",
      });
    }

    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const providerKey = this.providerIdempotencyKey(
      producer.id,
      "upload",
      idempotencyKey,
      contentHash,
    );

    try {
      return await this.blindPay.uploadDocument(
        {
          filename: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          content: file.buffer,
        },
        providerKey,
      );
    } catch (error) {
      throw this.mapProviderError(error, "document_upload_failed");
    }
  }

  async createCustomer(
    principal: AuthenticatedPrincipal,
    input: unknown,
    requestIp: string,
    clientIdempotencyKey: string | undefined,
  ): Promise<CreatedCustomerView> {
    const { user, producer } = await this.requireProducer(principal);
    const parsed = createBlindPayCustomerSchema.safeParse(input);
    if (!parsed.success) {
      throw this.invalidOnboardingInput();
    }

    const clientKey = this.parseIdempotencyKey(clientIdempotencyKey);
    const providerInput = this.toProviderCustomerInput(
      parsed.data,
      user.email,
      requestIp,
      producer.id,
    );
    const providerKey = this.providerIdempotencyKey(
      producer.id,
      "customer",
      clientKey,
      JSON.stringify(providerInput),
    );
    const customerType = parsed.data.type === "individual" ? "INDIVIDUAL" : "BUSINESS";

    let attempt: BlindPayCustomerRecord;
    try {
      attempt = await this.onboarding.prepareCustomerAttempt(user.id, customerType, providerKey);
    } catch (error) {
      if (error instanceof CustomerAttemptAlreadyActiveError) {
        throw this.customerAttemptConflict();
      }
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await this.onboarding.findByProviderIdempotencyKey(user.id, providerKey);
      if (winner === null) {
        throw this.customerAttemptConflict();
      }
      attempt = winner;
    }

    if (attempt.creationStatus === "CREATED") {
      return this.toCustomerView(attempt);
    }
    if (attempt.creationStatus === "FAILED") {
      throw new UnprocessableEntityException({
        code: "customer_attempt_failed",
        message: "This customer onboarding attempt cannot be retried.",
      });
    }

    try {
      const created = await this.blindPay.createCustomer(providerInput, providerKey);
      const kycStatus = await this.readInitialKycStatus(created.id);
      const stored = await this.onboarding.markCreated(
        user.id,
        attempt.id,
        created.id,
        storedKycStatus[kycStatus],
      );
      return this.toCustomerView(stored);
    } catch (error) {
      if (this.isPermanentProviderError(error)) {
        await this.onboarding.markFailed(
          user.id,
          attempt.id,
          this.providerFailureCode(error, "customer_rejected"),
        );
      }
      throw this.mapProviderError(error, "customer_creation_failed");
    }
  }

  async getOpenRfi(principal: AuthenticatedPrincipal): Promise<OpenRfiView> {
    const { user } = await this.requireProducer(principal);
    const customer = await this.requireCreatedCustomer(user.id);

    try {
      return await this.blindPay.getOpenRfi(customer.externalCustomerId);
    } catch (error) {
      throw this.mapProviderError(error, "rfi_fetch_failed");
    }
  }

  async submitRfi(
    principal: AuthenticatedPrincipal,
    input: unknown,
    clientIdempotencyKey: string | undefined,
  ): Promise<void> {
    const { user, producer } = await this.requireProducer(principal);
    const customer = await this.requireCreatedCustomer(user.id);
    const clientKey = this.parseIdempotencyKey(clientIdempotencyKey);

    let rfi: BlindPayRfi | null;
    try {
      rfi = await this.blindPay.getOpenRfi(customer.externalCustomerId);
    } catch (error) {
      throw this.mapProviderError(error, "rfi_fetch_failed");
    }
    if (rfi === null || rfi.status !== "pending") {
      throw new NotFoundException({ code: "rfi_not_found", message: "No open RFI was found." });
    }

    const answers = this.validateRfiAnswers(rfi, input);
    const providerKey = this.providerIdempotencyKey(
      producer.id,
      `rfi:${rfi.id}`,
      clientKey,
      JSON.stringify(answers),
    );

    try {
      await this.blindPay.submitRfi(customer.externalCustomerId, answers, providerKey);
    } catch (error) {
      throw this.mapProviderError(error, "rfi_submission_failed");
    }
  }

  private async requireProducer(principal: AuthenticatedPrincipal): Promise<{
    user: NonNullable<Awaited<ReturnType<UsersRepository["findByPrivyUserId"]>>>;
    producer: ProducerProfileRecord;
  }> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }

    const producer = await this.producers.findByUserId(user.id);
    if (producer === null) {
      throw new NotFoundException({
        code: "producer_not_found",
        message: "The authenticated account does not have a producer profile.",
      });
    }

    return { user, producer };
  }

  private async requireCreatedCustomer(
    userId: string,
  ): Promise<BlindPayCustomerRecord & { externalCustomerId: string }> {
    const customer = await this.onboarding.findCurrent(userId);
    if (
      customer === null ||
      customer.creationStatus !== "CREATED" ||
      customer.externalCustomerId === null
    ) {
      throw new NotFoundException({
        code: "blindpay_customer_not_found",
        message: "The producer does not have an active BlindPay customer.",
      });
    }

    return { ...customer, externalCustomerId: customer.externalCustomerId };
  }

  private toProviderCustomerInput(
    input: CreateBlindPayCustomerInput,
    email: string,
    requestIp: string,
    producerId: string,
  ): Record<string, unknown> {
    const common = {
      type: input.type,
      kyc_type: "standard",
      tos_id: input.tosId,
      email,
      external_id: producerId,
      tax_id: input.taxId,
      address_line_1: input.addressLine1,
      ...(input.addressLine2 === undefined ? {} : { address_line_2: input.addressLine2 }),
      city: input.city,
      state_province_region: input.stateProvinceRegion,
      country: input.country,
      postal_code: input.postalCode,
      phone_number: input.phoneNumber,
      ip_address: requestIp,
      ...(input.proofOfAddressDocType === undefined
        ? {}
        : { proof_of_address_doc_type: input.proofOfAddressDocType }),
      ...(input.proofOfAddressDocFile === undefined
        ? {}
        : { proof_of_address_doc_file: input.proofOfAddressDocFile }),
    };

    if (input.type === "individual") {
      return {
        ...common,
        first_name: input.firstName,
        last_name: input.lastName,
        date_of_birth: input.dateOfBirth,
        id_doc_country: input.idDocCountry,
        id_doc_type: input.idDocType,
        id_doc_front_file: input.idDocFrontFile,
        ...(input.idDocBackFile === undefined ? {} : { id_doc_back_file: input.idDocBackFile }),
        selfie_file: input.selfieFile,
      };
    }

    return {
      ...common,
      legal_name: input.legalName,
      ...(input.alternateName === undefined ? {} : { alternate_name: input.alternateName }),
      formation_date: input.formationDate,
      ...(input.website === undefined ? {} : { website: input.website }),
      ...(input.businessDescription === undefined
        ? {}
        : { business_description: input.businessDescription }),
      owners: input.owners.map((owner) => ({
        role: owner.role,
        ...(owner.title === undefined ? {} : { title: owner.title }),
        ...(owner.ownershipPercentage === undefined
          ? {}
          : { ownership_percentage: owner.ownershipPercentage }),
        first_name: owner.firstName,
        last_name: owner.lastName,
        date_of_birth: owner.dateOfBirth,
        tax_id: owner.taxId,
        address_line_1: owner.addressLine1,
        ...(owner.addressLine2 === undefined ? {} : { address_line_2: owner.addressLine2 }),
        city: owner.city,
        state_province_region: owner.stateProvinceRegion,
        country: owner.country,
        postal_code: owner.postalCode,
        id_doc_country: owner.idDocCountry,
        id_doc_type: owner.idDocType,
        id_doc_front_file: owner.idDocFrontFile,
        ...(owner.idDocBackFile === undefined ? {} : { id_doc_back_file: owner.idDocBackFile }),
        ...(owner.proofOfAddressDocType === undefined
          ? {}
          : { proof_of_address_doc_type: owner.proofOfAddressDocType }),
        ...(owner.proofOfAddressDocFile === undefined
          ? {}
          : { proof_of_address_doc_file: owner.proofOfAddressDocFile }),
      })),
      incorporation_doc_file: input.incorporationDocFile,
      proof_of_ownership_doc_file: input.proofOfOwnershipDocFile,
    };
  }

  private validateRfiAnswers(rfi: BlindPayRfi, input: unknown): BlindPayRfiAnswers {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw this.invalidRfiResponse();
    }

    const answers = input as Record<string, unknown>;
    const fields = rfi.request.flatMap((section) => section.fields);
    const allowedKeys = new Set(fields.map((field) => field.key));
    if (Object.keys(answers).some((key) => !allowedKeys.has(key))) {
      throw this.invalidRfiResponse();
    }

    const validated: BlindPayRfiAnswers = {};
    for (const field of fields) {
      const value = answers[field.key];
      if (value === undefined) {
        if (field.required) {
          throw this.invalidRfiResponse(field.key);
        }
        continue;
      }

      if (field.multiple === true) {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          value.length > 20 ||
          value.some((item) => typeof item !== "string" || item.length === 0 || item.length > 2_000)
        ) {
          throw this.invalidRfiResponse(field.key);
        }

        const stringValues = value as string[];
        if (
          field.items !== undefined &&
          stringValues.some((candidate) => !field.items?.some((item) => item.value === candidate))
        ) {
          throw this.invalidRfiResponse(field.key);
        }
        if (field.regex !== undefined) {
          const regex = this.compileProviderRegex(field.regex);
          if (stringValues.some((candidate) => !regex.test(candidate))) {
            throw this.invalidRfiResponse(field.key);
          }
        }
        validated[field.key] = stringValues;
        continue;
      }

      if (typeof value !== "string" || value.length === 0 || value.length > 5_000) {
        throw this.invalidRfiResponse(field.key);
      }
      if (field.items !== undefined && !field.items.some((item) => item.value === value)) {
        throw this.invalidRfiResponse(field.key);
      }
      if (field.regex !== undefined) {
        if (!this.compileProviderRegex(field.regex).test(value)) {
          throw this.invalidRfiResponse(field.key);
        }
      }
      validated[field.key] = value;
    }

    return validated;
  }

  private parseIdempotencyKey(value: string | undefined): string {
    const parsed = idempotencyKeySchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "invalid_idempotency_key",
        message: "Idempotency-Key must be a UUID.",
      });
    }
    return parsed.data;
  }

  private providerIdempotencyKey(
    producerId: string,
    operation: string,
    clientKey: string,
    intent: string,
  ): string {
    return createHash("sha256")
      .update(`${producerId}\0${operation}\0${clientKey}\0${intent}`)
      .digest("hex");
  }

  private toCustomerView(customer: BlindPayCustomerRecord): CreatedCustomerView {
    if (customer.externalCustomerId === null || customer.kycStatus === null) {
      throw new Error("A created BlindPay customer must have an external ID and KYC status.");
    }

    return {
      id: customer.id,
      customerId: customer.externalCustomerId,
      type: customer.customerType.toLowerCase() as CreatedCustomerView["type"],
      status: customer.kycStatus.toLowerCase() as CreatedCustomerView["status"],
    };
  }

  private invalidOnboardingInput(): BadRequestException {
    return new BadRequestException({
      code: "invalid_onboarding_input",
      message: "The onboarding information is invalid.",
    });
  }

  private invalidRfiResponse(field?: string): BadRequestException {
    return new BadRequestException({
      code: "invalid_rfi_response",
      message: "The RFI response is invalid.",
      ...(field === undefined ? {} : { field }),
    });
  }

  private compileProviderRegex(value: string): RegExp {
    try {
      return new RegExp(value);
    } catch {
      throw new ServiceUnavailableException({
        code: "compliance_provider_invalid_response",
        message: "The compliance provider returned an invalid request.",
      });
    }
  }

  private customerAttemptConflict(): ConflictException {
    return new ConflictException({
      code: "customer_attempt_already_active",
      message: "A BlindPay customer attempt is already active for this producer.",
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  /**
   * The customer already exists at this point, so a failed read must not lose it: the status
   * falls back to verifying and the customer lifecycle webhook brings the real one.
   */
  private async readInitialKycStatus(customerId: string): Promise<BlindPayKycStatusValue> {
    try {
      return await this.blindPay.getCustomerKycStatus(customerId);
    } catch (error) {
      if (!this.isProviderError(error)) {
        throw error;
      }
      this.logger.warn(`BlindPay customer ${customerId} status read failed (${error.operation}).`);
      return "verifying";
    }
  }

  /** Only an explicit rejection of the request is final; any other failure may have succeeded. */
  private isPermanentProviderError(error: unknown): error is BlindPayProviderError {
    return (
      this.isProviderError(error) &&
      !error.retryable &&
      error.statusCode !== undefined &&
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      error.statusCode !== 401 &&
      error.statusCode !== 403
    );
  }

  private isProviderError(error: unknown): error is BlindPayProviderError {
    return error instanceof Error && error.name === "BlindPayProviderError" && "retryable" in error;
  }

  private providerFailureCode(error: BlindPayProviderError, fallback: string): string {
    const code = error.providerCode;
    return code !== undefined && /^[a-zA-Z0-9_.-]{1,100}$/.test(code) ? code : fallback;
  }

  private mapProviderError(error: unknown, fallbackCode: string): Error {
    if (!this.isProviderError(error)) {
      return new ServiceUnavailableException({
        code: "compliance_provider_unavailable",
        message: "The compliance provider is temporarily unavailable.",
      });
    }

    if (error.retryable || error.statusCode === 401 || error.statusCode === 403) {
      return new ServiceUnavailableException({
        code: "compliance_provider_unavailable",
        message: "The compliance provider is temporarily unavailable.",
      });
    }

    return new UnprocessableEntityException({
      code: fallbackCode,
      message: "The compliance provider rejected the request.",
      providerCode: this.providerFailureCode(error, "provider_rejected"),
    });
  }
}
