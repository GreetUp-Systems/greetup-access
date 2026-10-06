import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

import { type BlindPayPayin, type BlindPayPayinQuote } from "../common/blindpay/blindpay.types";

const purchaseInclude = {
  tickets: { orderBy: { createdAt: "asc" } },
  // Public event data for the checkout screens (SPEC-005 v1.8).
  event: {
    select: {
      slug: true,
      name: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      address: true,
    },
  },
  ticketType: { select: { id: true, name: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseRecord = Prisma.PurchaseGetPayload<{ include: typeof purchaseInclude }>;

/** Sales destination of a published ticket type, read through checkout_listing(). */
export interface CheckoutListing {
  ticketTypeId: string;
  eventId: string;
  producerId: string;
  startsAt: Date;
  unitPriceCents: number;
  stellarStatus: string | null;
  customerCreationStatus: string | null;
  kycStatus: string | null;
  blockchainWalletId: string | null;
}

export const checkoutErrorCodes = [
  "purchase_invalid_quantity",
  "ticket_type_not_found",
  "purchase_idempotency_conflict",
  "event_not_on_sale",
  // Only the column's integer range; the configured ceiling is checked before (D-26).
  "purchase_above_maximum",
  "ticket_type_sold_out",
] as const;

export type CheckoutErrorCode = (typeof checkoutErrorCodes)[number];

export class CheckoutError extends Error {
  constructor(readonly code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutError";
  }
}

interface ListingRow {
  listing_ticket_type_id: string;
  listing_event_id: string;
  listing_producer_id: string;
  listing_starts_at: Date;
  listing_unit_price_cents: number;
  listing_stellar_status: string | null;
  listing_customer_creation_status: string | null;
  listing_kyc_status: string | null;
  listing_blockchain_wallet_id: string | null;
}

@Injectable()
export class PurchasesRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async listing(userId: string, ticketTypeId: string): Promise<CheckoutListing | null> {
    const rows = await this.tenantContext.withUserContext(
      userId,
      (transaction) => transaction.$queryRaw<ListingRow[]>`
        SELECT * FROM "checkout_listing"(${ticketTypeId}::uuid)
      `,
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }

    return {
      ticketTypeId: row.listing_ticket_type_id,
      eventId: row.listing_event_id,
      producerId: row.listing_producer_id,
      startsAt: row.listing_starts_at,
      unitPriceCents: row.listing_unit_price_cents,
      stellarStatus: row.listing_stellar_status,
      customerCreationStatus: row.listing_customer_creation_status,
      kycStatus: row.listing_kyc_status,
      blockchainWalletId: row.listing_blockchain_wallet_id,
    };
  }

  /** Reserves stock and records the purchase atomically inside reserve_purchase(). */
  async reserve(
    userId: string,
    ticketTypeId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<{ purchaseId: string; created: boolean }> {
    try {
      return await this.reserveOnce(userId, ticketTypeId, quantity, idempotencyKey);
    } catch (error) {
      // Two first requests with the same key: the loser hits the unique index and finds the winner.
      if (this.isUniqueViolation(error)) {
        return this.reserveOnce(userId, ticketTypeId, quantity, idempotencyKey);
      }
      throw error;
    }
  }

  find(userId: string, purchaseId: string): Promise<PurchaseRecord | null> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.purchase.findFirst({
        where: { id: purchaseId, buyerUserId: userId },
        include: purchaseInclude,
      }),
    );
  }

  recordQuote(
    userId: string,
    purchaseId: string,
    quote: BlindPayPayinQuote,
    subtotalCents: number,
  ): Promise<PurchaseRecord> {
    return this.updateInitiated(userId, purchaseId, {
      externalQuoteId: quote.id,
      quoteExpiresAt: quote.expiresAt,
      totalCents: quote.senderAmount,
      serviceFeeCents: quote.senderAmount - subtotalCents,
      receiverAmount: BigInt(Math.round(quote.receiverAmount)),
      blindpayFlatFee: BigInt(Math.round(quote.flatFee)),
      partnerFeeAmount: BigInt(Math.round(quote.partnerFeeAmount)),
      commercialRate: new Prisma.Decimal(quote.commercialQuotation),
      blindpayRate: new Prisma.Decimal(quote.blindpayQuotation),
    });
  }

  markAwaitingPayment(
    userId: string,
    purchaseId: string,
    payin: BlindPayPayin,
  ): Promise<PurchaseRecord> {
    return this.updateInitiated(userId, purchaseId, {
      externalPayinId: payin.id,
      pixCode: payin.pixCode,
      status: "AWAITING_PAYMENT",
    });
  }

  markFailed(userId: string, purchaseId: string, failureCode: string): Promise<PurchaseRecord> {
    return this.updateInitiated(userId, purchaseId, {
      status: "PAYMENT_FAILED",
      failureCode: failureCode.slice(0, 80),
    });
  }

  private reserveOnce(
    userId: string,
    ticketTypeId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<{ purchaseId: string; created: boolean }> {
    return this.tenantContext
      .withUserContext(
        userId,
        (transaction) => transaction.$queryRaw<
          Array<{ reserved_purchase_id: string; reserved_created: boolean }>
        >`
          SELECT * FROM "reserve_purchase"(${ticketTypeId}::uuid, ${quantity}::int, ${idempotencyKey})
        `,
      )
      .then(([row]) => {
        if (row === undefined) {
          throw new Error("reserve_purchase_returned_no_row");
        }
        return { purchaseId: row.reserved_purchase_id, created: row.reserved_created };
      })
      .catch((error: unknown) => {
        throw this.toCheckoutError(error) ?? error;
      });
  }

  // Only an initiated purchase advances here, so a late retry never rewrites a later state.
  private updateInitiated(
    userId: string,
    purchaseId: string,
    data: Prisma.PurchaseUpdateManyMutationInput,
  ): Promise<PurchaseRecord> {
    return this.tenantContext.withUserContext(userId, async (transaction) => {
      await transaction.purchase.updateMany({
        where: { id: purchaseId, buyerUserId: userId, status: "INITIATED" },
        data,
      });
      return transaction.purchase.findFirstOrThrow({
        where: { id: purchaseId, buyerUserId: userId },
        include: purchaseInclude,
      });
    });
  }

  private toCheckoutError(error: unknown): CheckoutError | undefined {
    const message = error instanceof Error ? error.message : "";
    const code = checkoutErrorCodes.find((candidate) => message.includes(candidate));
    return code === undefined ? undefined : new CheckoutError(code);
  }

  private isUniqueViolation(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      message.includes("23505")
    );
  }
}
