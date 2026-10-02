import { Prisma } from "@access/database";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { UsersRepository } from "../users/users.repository";
import { ProducersRepository, type ProducerProfileRecord } from "./producers.repository";
import { type ProducerProfileView } from "./producers.types";

const operationalKycStatuses = new Set(["APPROVED", "APPROVED_RFI"]);

@Injectable()
export class ProducersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly producers: ProducersRepository,
  ) {}

  async create(principal: AuthenticatedPrincipal, input: unknown): Promise<ProducerProfileView> {
    const displayName = this.parseDisplayName(input);
    const user = await this.requireBootstrappedUser(principal);
    const existing = await this.producers.findByUserId(user.id);

    if (existing !== null) {
      return this.resolveExisting(existing, displayName);
    }

    try {
      return this.toView(await this.producers.create(user.id, displayName));
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await this.producers.findByUserId(user.id);
      if (winner !== null) {
        return this.resolveExisting(winner, displayName);
      }

      throw error;
    }
  }

  async me(principal: AuthenticatedPrincipal): Promise<ProducerProfileView> {
    const user = await this.requireBootstrappedUser(principal);
    const producer = await this.producers.findByUserId(user.id);

    if (producer === null) {
      throw new NotFoundException({
        code: "producer_not_found",
        message: "The authenticated account does not have a producer profile.",
      });
    }

    return this.toView(producer);
  }

  private async requireBootstrappedUser(principal: AuthenticatedPrincipal) {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);

    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }

    return user;
  }

  private parseDisplayName(input: unknown): string {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw this.invalidProfile();
    }

    const body = input as Record<string, unknown>;
    if (Object.keys(body).some((key) => key !== "displayName")) {
      throw this.invalidProfile();
    }

    const displayName = body.displayName;
    if (typeof displayName !== "string") {
      throw this.invalidProfile();
    }

    const normalized = displayName.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw this.invalidProfile();
    }

    return normalized;
  }

  private resolveExisting(
    producer: ProducerProfileRecord,
    requestedDisplayName: string,
  ): ProducerProfileView {
    if (producer.displayName !== requestedDisplayName) {
      throw new ConflictException({
        code: "producer_already_exists",
        message: "A producer profile already exists for this account.",
      });
    }

    return this.toView(producer);
  }

  private invalidProfile(): BadRequestException {
    return new BadRequestException({
      code: "invalid_producer_profile",
      message: "displayName must contain between 1 and 120 characters.",
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private toView(producer: ProducerProfileRecord): ProducerProfileView {
    const customer = producer.blindPayCustomers[0];
    const complianceStatus = customer?.kycStatus?.toLowerCase() as
      ProducerProfileView["compliance"]["status"] | undefined;
    const hasOpenRfi =
      customer?.kycStatus === "COMPLIANCE_REQUEST" || customer?.kycStatus === "APPROVED_RFI";
    const onboardingStatus =
      customer === undefined
        ? "profile_created"
        : operationalKycStatuses.has(customer.kycStatus ?? "")
          ? "stellar_pending"
          : "compliance_pending";

    return {
      id: producer.id,
      displayName: producer.displayName,
      onboardingStatus,
      compliance: { status: complianceStatus ?? null, hasOpenRfi },
      stellar: { status: "not_started" },
    };
  }
}
