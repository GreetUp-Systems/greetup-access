import { randomUUID } from "node:crypto";

import { type BlindPayGateway, BlindPayProviderError } from "../common/blindpay/blindpay.types";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import {
  CheckoutError,
  type CheckoutListing,
  type PurchaseRecord,
  PurchasesRepository,
} from "./purchases.repository";
import { PurchasesService } from "./purchases.service";

const now = new Date();
const principal = { privyUserId: "did:privy:buyer", sessionId: "session", accessToken: "jwt" };
const idempotencyKey = randomUUID();
const purchaseId = "00000000-0000-4000-8000-000000000030";
const ticketTypeId = "00000000-0000-4000-8000-000000000020";
const user: UserWithWallet = {
  id: "00000000-0000-4000-8000-000000000001",
  privyUserId: principal.privyUserId,
  email: "buyer@example.com",
  spontaneousLoginAt: null,
  createdAt: now,
  updatedAt: now,
  wallet: {
    id: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000001",
    privyWalletId: "wallet-id",
    stellarAddress: `G${"A".repeat(55)}`,
    createdAt: now,
    updatedAt: now,
  },
};
const readyListing: CheckoutListing = {
  ticketTypeId,
  eventId: "00000000-0000-4000-8000-000000000010",
  producerId: "00000000-0000-4000-8000-000000000003",
  startsAt: new Date(Date.now() + 86_400_000),
  unitPriceCents: 8_000,
  stellarStatus: "active",
  customerCreationStatus: "created",
  kycStatus: "approved",
  blockchainWalletId: "bw_producer",
};
const quote = {
  id: "qu_test",
  expiresAt: new Date(Date.now() + 5 * 60_000),
  senderAmount: 16_980,
  receiverAmount: 2_950,
  commercialQuotation: 5.42,
  blindpayQuotation: 5.5,
  flatFee: 0,
  partnerFeeAmount: 0,
};

function purchase(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: purchaseId,
    buyerUserId: user.id,
    producerId: readyListing.producerId,
    eventId: readyListing.eventId,
    ticketTypeId,
    quantity: 2,
    unitPriceCents: 8_000,
    subtotalCents: 16_000,
    totalCents: null,
    serviceFeeCents: null,
    receiverAmount: null,
    blindpayFlatFee: null,
    partnerFeeAmount: null,
    commercialRate: null,
    blindpayRate: null,
    externalQuoteId: null,
    quoteExpiresAt: null,
    externalPayinId: null,
    pixCode: null,
    idempotencyKey,
    status: "INITIATED",
    failureCode: null,
    paymentConfirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tickets: [],
    ...overrides,
  };
}

describe("PurchasesService", () => {
  let users: jest.Mocked<Pick<UsersRepository, "findByPrivyUserId">>;
  let repository: jest.Mocked<
    Pick<
      PurchasesRepository,
      "listing" | "reserve" | "find" | "recordQuote" | "markAwaitingPayment" | "markFailed"
    >
  >;
  let blindPay: jest.Mocked<Pick<BlindPayGateway, "createPayinQuote" | "createPayin">>;
  let service: PurchasesService;

  beforeEach(() => {
    users = { findByPrivyUserId: jest.fn().mockResolvedValue(user) };
    repository = {
      listing: jest.fn().mockResolvedValue(readyListing),
      reserve: jest.fn().mockResolvedValue({ purchaseId, created: true }),
      find: jest.fn().mockResolvedValue(purchase()),
      recordQuote: jest.fn().mockResolvedValue(purchase({ externalQuoteId: quote.id })),
      markAwaitingPayment: jest.fn().mockResolvedValue(
        purchase({
          status: "AWAITING_PAYMENT",
          externalPayinId: "pi_test",
          pixCode: "00020126pix",
          totalCents: 16_980,
          serviceFeeCents: 980,
        }),
      ),
      markFailed: jest
        .fn()
        .mockImplementation((_userId, _id, failureCode: string) =>
          Promise.resolve(purchase({ status: "PAYMENT_FAILED", failureCode })),
        ),
    };
    blindPay = {
      createPayinQuote: jest.fn().mockResolvedValue(quote),
      createPayin: jest
        .fn()
        .mockResolvedValue({ id: "pi_test", status: "processing", pixCode: "00020126pix" }),
    };
    service = new PurchasesService(
      users as unknown as UsersRepository,
      repository as unknown as PurchasesRepository,
      blindPay as unknown as BlindPayGateway,
      { token: "USDB", partnerFeeId: undefined },
    );
  });

  const body = { ticketTypeId, quantity: 2 };

  it("reserves, quotes to the producer wallet and returns the Pix with a single service fee", async () => {
    await expect(service.create(principal, body, idempotencyKey)).resolves.toMatchObject({
      status: "awaiting_payment",
      subtotalCents: 16_000,
      serviceFeeCents: 980,
      totalCents: 16_980,
      pixCode: "00020126pix",
    });

    expect(repository.reserve).toHaveBeenCalledWith(user.id, ticketTypeId, 2, idempotencyKey);
    expect(blindPay.createPayinQuote).toHaveBeenCalledWith(
      {
        blockchainWalletId: "bw_producer",
        requestAmountCents: 16_000,
        token: "USDB",
        partnerFeeId: undefined,
      },
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(repository.recordQuote).toHaveBeenCalledWith(user.id, purchaseId, quote, 16_000);
    expect(blindPay.createPayin).toHaveBeenCalledWith(
      quote.id,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it.each([
    [undefined, "invalid_idempotency_key"],
    ["not-a-uuid", "invalid_idempotency_key"],
  ])("requires a UUID Idempotency-Key (%p)", async (key, code) => {
    await expect(service.create(principal, body, key)).rejects.toMatchObject({
      response: { code },
    });
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it.each([
    [{ ticketTypeId, quantity: 0 }],
    [{ ticketTypeId, quantity: 11 }],
    [{ ticketTypeId: "x", quantity: 1 }],
    [{ ...body, cpf: "12345678900" }],
  ])("rejects an invalid body %#", async (invalid) => {
    await expect(service.create(principal, invalid, idempotencyKey)).rejects.toMatchObject({
      response: { code: "invalid_purchase" },
    });
  });

  it.each([
    ["stellar", { stellarStatus: "pending" }],
    ["kyc", { kycStatus: "verifying" }],
    ["wallet", { blockchainWalletId: null }],
  ])("refuses to sell when the producer %s track is not ready", async (_label, partial) => {
    repository.listing.mockResolvedValue({ ...readyListing, ...partial });

    await expect(service.create(principal, body, idempotencyKey)).rejects.toMatchObject({
      response: { code: "producer_not_ready_for_sales" },
    });
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it("maps a sold-out reservation without calling BlindPay", async () => {
    repository.reserve.mockRejectedValue(new CheckoutError("ticket_type_sold_out"));

    await expect(service.create(principal, body, idempotencyKey)).rejects.toMatchObject({
      response: { code: "ticket_type_sold_out" },
    });
    expect(blindPay.createPayinQuote).not.toHaveBeenCalled();
  });

  it("returns an existing purchase for a repeated key without a second payin", async () => {
    repository.reserve.mockResolvedValue({ purchaseId, created: false });
    repository.find.mockResolvedValue(
      purchase({ status: "AWAITING_PAYMENT", pixCode: "00020126pix" }),
    );

    await expect(service.create(principal, body, idempotencyKey)).resolves.toMatchObject({
      status: "awaiting_payment",
    });
    expect(blindPay.createPayinQuote).not.toHaveBeenCalled();
    expect(blindPay.createPayin).not.toHaveBeenCalled();
  });

  it("resumes an initiated purchase reusing a still valid quote", async () => {
    repository.reserve.mockResolvedValue({ purchaseId, created: false });
    repository.find.mockResolvedValue(
      purchase({ externalQuoteId: "qu_old", quoteExpiresAt: new Date(Date.now() + 120_000) }),
    );

    await service.create(principal, body, idempotencyKey);

    expect(blindPay.createPayinQuote).not.toHaveBeenCalled();
    expect(blindPay.createPayin).toHaveBeenCalledWith("qu_old", expect.any(String));
  });

  it("fails an initiated purchase whose reservation already lapsed", async () => {
    repository.reserve.mockResolvedValue({ purchaseId, created: false });
    repository.find.mockResolvedValue(purchase({ createdAt: new Date(Date.now() - 11 * 60_000) }));

    await expect(service.create(principal, body, idempotencyKey)).resolves.toMatchObject({
      status: "payment_failed",
    });
    expect(repository.markFailed).toHaveBeenCalledWith(user.id, purchaseId, "reservation_expired");
    expect(blindPay.createPayinQuote).not.toHaveBeenCalled();
  });

  it("keeps the purchase resumable when BlindPay is temporarily unavailable", async () => {
    blindPay.createPayin.mockRejectedValue(new BlindPayProviderError("create_payin", true, 503));

    await expect(service.create(principal, body, idempotencyKey)).rejects.toMatchObject({
      response: { code: "payment_provider_unavailable" },
    });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("fails the purchase on a final BlindPay rejection", async () => {
    blindPay.createPayinQuote.mockRejectedValue(
      new BlindPayProviderError("create_payin_quote", false, 400, "AMOUNT_BELOW_MINIMUM"),
    );

    await expect(service.create(principal, body, idempotencyKey)).rejects.toMatchObject({
      response: { code: "payment_rejected" },
    });
    expect(repository.markFailed).toHaveBeenCalledWith(
      user.id,
      purchaseId,
      "create_payin_quote:AMOUNT_BELOW_MINIMUM",
    );
  });

  it("refuses a quote that charges the buyer less than the ticket price", async () => {
    blindPay.createPayinQuote.mockResolvedValue({ ...quote, senderAmount: 15_000 });

    await expect(service.create(principal, body, idempotencyKey)).rejects.toMatchObject({
      response: { code: "payment_rejected" },
    });
    expect(repository.recordQuote).not.toHaveBeenCalled();
    expect(blindPay.createPayin).not.toHaveBeenCalled();
  });

  it("hides the Pix code once the purchase is no longer awaiting payment", async () => {
    repository.find.mockResolvedValue(
      purchase({ status: "PAYMENT_CONFIRMED", pixCode: "00020126pix" }),
    );

    await expect(service.get(principal, purchaseId)).resolves.toMatchObject({
      status: "payment_confirmed",
      pixCode: null,
    });
  });
});
