import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import {
  BLINDPAY_GATEWAY,
  type BlindPayGateway,
  type BlindPayPayinQuote,
  BlindPayProviderError,
} from "../common/blindpay/blindpay.types";
import { UsersRepository } from "../users/users.repository";
import {
  type CheckoutErrorCode,
  CheckoutError,
  type CheckoutListing,
  type PurchaseRecord,
  PurchasesRepository,
} from "./purchases.repository";
import { createPurchaseSchema, generatePixSchema, idempotencyKeySchema } from "./purchases.schemas";
import {
  PURCHASE_CHECKOUT_CONFIG,
  type PurchaseCheckoutConfig,
  type PurchaseStatusView,
  type PurchaseView,
} from "./purchases.types";

// Same window as committed_ticket_quantity(): after it an initiated purchase holds no stock.
const initiatedReservationMs = 10 * 60 * 1_000;
// A stored quote is reused only while it still has time for the payin call.
const quoteSafetyMarginMs = 30 * 1_000;
const operationalKycStatuses = new Set(["approved", "approved_rfi"]);

const checkoutErrors: Record<CheckoutErrorCode, () => HttpException> = {
  purchase_invalid_quantity: () =>
    new BadRequestException({ code: "invalid_purchase", message: "Quantity must be 1 to 10." }),
  ticket_type_not_found: () => ticketTypeNotAvailable(),
  purchase_idempotency_conflict: () =>
    new ConflictException({
      code: "idempotency_key_reused",
      message: "The Idempotency-Key was already used for a different purchase.",
    }),
  event_not_on_sale: () =>
    new ConflictException({ code: "event_not_on_sale", message: "The event is not on sale." }),
  purchase_below_minimum: () =>
    new UnprocessableEntityException({
      code: "purchase_below_minimum",
      message: "A purchase must total at least R$ 10.",
    }),
  purchase_above_maximum: () =>
    new UnprocessableEntityException({
      code: "purchase_above_maximum",
      message: "The purchase total is above the allowed maximum.",
    }),
  ticket_type_sold_out: () =>
    new ConflictException({
      code: "ticket_type_sold_out",
      message: "There are not enough tickets left of this type.",
    }),
};

function purchaseNotFound(): NotFoundException {
  return new NotFoundException({
    code: "purchase_not_found",
    message: "The purchase does not exist.",
  });
}

function ticketTypeNotAvailable(): NotFoundException {
  return new NotFoundException({
    code: "ticket_type_not_available",
    message: "The ticket type is not available for sale.",
  });
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly users: UsersRepository,
    private readonly purchases: PurchasesRepository,
    @Inject(BLINDPAY_GATEWAY) private readonly blindPay: BlindPayGateway,
    @Inject(PURCHASE_CHECKOUT_CONFIG) private readonly config: PurchaseCheckoutConfig,
  ) {}

  async create(
    principal: AuthenticatedPrincipal,
    body: unknown,
    clientIdempotencyKey: string | undefined,
  ): Promise<PurchaseView> {
    const idempotencyKey = this.parseIdempotencyKey(clientIdempotencyKey);
    const input = createPurchaseSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException({
        code: "invalid_purchase",
        message: "The request body is invalid.",
        fields: [...new Set(input.error.issues.map((issue) => issue.path.join(".")))],
      });
    }
    const userId = await this.requireUserId(principal);

    const listing = await this.purchases.listing(userId, input.data.ticketTypeId);
    if (listing === null) {
      throw ticketTypeNotAvailable();
    }
    const destinationWalletId = this.salesDestination(listing);

    const reservation = await this.withCheckoutErrors(() =>
      this.purchases.reserve(userId, input.data.ticketTypeId, input.data.quantity, idempotencyKey),
    );
    const purchase = await this.requirePurchase(userId, reservation.purchaseId);

    if (purchase.status !== "INITIATED") {
      return this.toView(purchase);
    }
    // A retry after the reservation lapsed must not quote a purchase without guaranteed stock.
    if (this.reservationExpired(purchase)) {
      return this.toView(
        await this.purchases.markFailed(userId, purchase.id, "reservation_expired"),
      );
    }

    // Step 1 of 2 (SPEC-005 §9): reserve and quote, so the buyer sees the fee before the Pix.
    await this.withProviderErrors(userId, purchase, () =>
      this.ensureQuote(userId, purchase, destinationWalletId),
    );
    return this.toView(await this.requirePurchase(userId, purchase.id));
  }

  /**
   * Step 2 of 2 (SPEC-005 §9): creates the Pix with the quoted total the buyer confirmed. An
   * expired quote is replaced; a different total is refused so nothing is charged unseen.
   */
  async generatePix(
    principal: AuthenticatedPrincipal,
    purchaseId: string,
    body: unknown,
  ): Promise<PurchaseView> {
    const input = generatePixSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException({
        code: "invalid_purchase_pix",
        message: "The request body is invalid.",
      });
    }
    const userId = await this.requireUserId(principal);
    const purchase = await this.purchases.find(userId, purchaseId);
    if (purchase === null) {
      throw purchaseNotFound();
    }
    if (purchase.status === "PAYMENT_FAILED" || purchase.status === "PAYMENT_REFUNDED") {
      throw new ConflictException({
        code: "purchase_not_payable",
        message: "This purchase can no longer be paid.",
      });
    }
    if (purchase.status !== "INITIATED") {
      return this.toView(purchase);
    }
    if (this.reservationExpired(purchase)) {
      await this.purchases.markFailed(userId, purchase.id, "reservation_expired");
      throw new ConflictException({
        code: "purchase_expired",
        message: "The reservation expired. Start a new purchase.",
      });
    }

    const listing = await this.purchases.listing(userId, purchase.ticketTypeId);
    if (listing === null) {
      throw ticketTypeNotAvailable();
    }
    const destinationWalletId = this.salesDestination(listing);

    return this.withProviderErrors(userId, purchase, async () => {
      const quoteId = await this.ensureQuote(userId, purchase, destinationWalletId);
      const quoted = await this.requirePurchase(userId, purchase.id);
      if (quoted.totalCents !== input.data.expectedTotalCents) {
        throw new ConflictException({
          code: "purchase_total_changed",
          message: "The total changed. Confirm the new total to continue.",
          purchase: this.toView(quoted),
        });
      }
      const payin = await this.blindPay.createPayin(
        quoteId,
        this.hashKey(`payin:${purchase.id}:${quoteId}`),
      );
      return this.toView(await this.purchases.markAwaitingPayment(userId, purchase.id, payin));
    });
  }

  async get(principal: AuthenticatedPrincipal, purchaseId: string): Promise<PurchaseView> {
    const userId = await this.requireUserId(principal);
    const purchase = await this.purchases.find(userId, purchaseId);
    if (purchase === null) {
      throw purchaseNotFound();
    }
    return this.toView(purchase);
  }

  /** Retryable provider errors keep the purchase initiated; final ones release the reservation. */
  private async withProviderErrors<T>(
    userId: string,
    purchase: PurchaseRecord,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof BlindPayProviderError)) {
        throw error;
      }
      if (error.retryable) {
        // The purchase stays initiated, so repeating the call resumes it.
        throw new ServiceUnavailableException({
          code: "payment_provider_unavailable",
          message: "The payment provider is temporarily unavailable. Try again.",
        });
      }
      const failureCode = `${error.operation}:${error.providerCode ?? error.statusCode ?? "error"}`;
      await this.purchases.markFailed(userId, purchase.id, failureCode);
      throw new UnprocessableEntityException({
        code: "payment_rejected",
        message: "The payment could not be created for this purchase.",
      });
    }
  }

  private reservationExpired(purchase: PurchaseRecord): boolean {
    return Date.now() - purchase.createdAt.getTime() >= initiatedReservationMs;
  }

  private async requirePurchase(userId: string, purchaseId: string): Promise<PurchaseRecord> {
    const purchase = await this.purchases.find(userId, purchaseId);
    if (purchase === null) {
      throw new ServiceUnavailableException({
        code: "purchase_unavailable",
        message: "The purchase is temporarily unavailable.",
      });
    }
    return purchase;
  }

  private async ensureQuote(
    userId: string,
    purchase: PurchaseRecord,
    destinationWalletId: string,
  ): Promise<string> {
    if (
      purchase.externalQuoteId !== null &&
      purchase.quoteExpiresAt !== null &&
      purchase.quoteExpiresAt.getTime() - Date.now() > quoteSafetyMarginMs
    ) {
      return purchase.externalQuoteId;
    }

    const quote = await this.blindPay.createPayinQuote(
      {
        blockchainWalletId: destinationWalletId,
        requestAmountCents: purchase.subtotalCents,
        token: this.config.token,
        partnerFeeId: this.config.partnerFeeId,
      },
      this.hashKey(`quote:${purchase.id}:${Date.now()}`),
    );
    this.assertQuoteCoversSubtotal(quote, purchase.subtotalCents);
    await this.purchases.recordQuote(userId, purchase.id, quote, purchase.subtotalCents);
    return quote.id;
  }

  // With cover_fees the buyer pays the fees on top of the ticket price (SPEC-005 §9).
  private assertQuoteCoversSubtotal(quote: BlindPayPayinQuote, subtotalCents: number): void {
    if (!Number.isInteger(quote.senderAmount) || quote.senderAmount < subtotalCents) {
      throw new BlindPayProviderError("create_payin_quote_unexpected_amount", false);
    }
  }

  private salesDestination(listing: CheckoutListing): string {
    const ready =
      listing.stellarStatus === "active" &&
      listing.customerCreationStatus === "created" &&
      operationalKycStatuses.has(listing.kycStatus ?? "") &&
      listing.blockchainWalletId !== null;
    if (!ready || listing.blockchainWalletId === null) {
      throw new ConflictException({
        code: "producer_not_ready_for_sales",
        message: "The event cannot receive payments right now.",
      });
    }
    return listing.blockchainWalletId;
  }

  private async withCheckoutErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw checkoutErrors[error.code]();
      }
      throw error;
    }
  }

  private async requireUserId(principal: AuthenticatedPrincipal): Promise<string> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    return user.id;
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

  private hashKey(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private toView(purchase: PurchaseRecord): PurchaseView {
    const status = purchase.status.toLowerCase() as PurchaseStatusView;
    return {
      id: purchase.id,
      status,
      eventId: purchase.eventId,
      ticketTypeId: purchase.ticketTypeId,
      quantity: purchase.quantity,
      unitPriceCents: purchase.unitPriceCents,
      subtotalCents: purchase.subtotalCents,
      serviceFeeCents: purchase.serviceFeeCents,
      totalCents: purchase.totalCents,
      pixCode: status === "awaiting_payment" ? purchase.pixCode : null,
      createdAt: purchase.createdAt.toISOString(),
      tickets: purchase.tickets.map((ticket) => ({
        id: ticket.id,
        status: ticket.status === "ISSUED" ? "issued" : "pending_mint",
        tokenId: ticket.tokenId,
      })),
    };
  }
}
