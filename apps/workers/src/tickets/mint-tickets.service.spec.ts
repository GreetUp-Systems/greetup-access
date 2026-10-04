import { UnrecoverableError } from "bullmq";

import { TicketContractError, type TicketContractGateway } from "../chain/ticket-contract.gateway";
import { type MintTicketsRepository, type PurchaseToMint } from "./mint-tickets.repository";
import { MintTicketsService } from "./mint-tickets.service";

const now = new Date();
const eventId = "00000000-0000-4000-8000-000000000010";

function ticket(id: string, status: "PENDING_MINT" | "ISSUED" = "PENDING_MINT") {
  return {
    id,
    purchaseId: "p",
    producerId: "producer",
    eventId,
    ticketTypeId: "type",
    ownerUserId: "buyer",
    status,
    tokenId: status === "ISSUED" ? 7 : null,
    mintTxHash: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function purchase(overrides: Partial<PurchaseToMint> = {}): PurchaseToMint {
  return {
    id: "p",
    buyerUserId: "buyer",
    producerId: "producer",
    eventId,
    ticketTypeId: "type",
    quantity: 2,
    unitPriceCents: 5_000,
    subtotalCents: 10_000,
    totalCents: 10_500,
    serviceFeeCents: 500,
    receiverAmount: null,
    blindpayFlatFee: null,
    partnerFeeAmount: null,
    commercialRate: null,
    blindpayRate: null,
    externalQuoteId: "qu",
    quoteExpiresAt: null,
    externalPayinId: "pi",
    pixCode: null,
    idempotencyKey: "k",
    status: "PAYMENT_CONFIRMED",
    failureCode: null,
    paymentConfirmedAt: now,
    createdAt: now,
    updatedAt: now,
    tickets: [ticket("t1"), ticket("t2")],
    event: { id: eventId, capacity: 300 },
    ...overrides,
  } as PurchaseToMint;
}

describe("MintTicketsService", () => {
  let repository: jest.Mocked<
    Pick<MintTicketsRepository, "findPurchase" | "buyerAddress" | "markIssued" | "completeIfIssued">
  >;
  let contract: jest.Mocked<TicketContractGateway>;
  let service: MintTicketsService;

  beforeEach(() => {
    repository = {
      findPurchase: jest.fn().mockResolvedValue(purchase()),
      buyerAddress: jest.fn().mockResolvedValue(`G${"A".repeat(55)}`),
      markIssued: jest.fn().mockResolvedValue(undefined),
      completeIfIssued: jest.fn().mockResolvedValue(true),
    };
    let nextToken = 0;
    contract = {
      event: jest.fn().mockResolvedValue({ capacity: 300, minted: 0 }),
      setEventCapacity: jest.fn().mockResolvedValue(undefined),
      mint: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ tokenId: (nextToken += 1), transactionHash: "h".repeat(64) }),
        ),
    };
    service = new MintTicketsService(repository as unknown as MintTicketsRepository, contract);
  });

  it("mints every pending ticket to the buyer and completes the purchase", async () => {
    await expect(service.mintPurchase("p")).resolves.toBe("issued");

    expect(contract.setEventCapacity).not.toHaveBeenCalled();
    expect(contract.mint).toHaveBeenCalledWith("t1", eventId, `G${"A".repeat(55)}`);
    expect(contract.mint).toHaveBeenCalledWith("t2", eventId, `G${"A".repeat(55)}`);
    expect(repository.markIssued).toHaveBeenCalledWith("t1", "p", 1, "h".repeat(64));
    expect(repository.completeIfIssued).toHaveBeenCalledWith("p");
  });

  it.each([
    ["missing on-chain", null],
    ["divergent", { capacity: 200, minted: 3 }],
  ])("syncs the event capacity when it is %s", async (_label, onChain) => {
    contract.event.mockResolvedValue(onChain);

    await service.mintPurchase("p");

    expect(contract.setEventCapacity).toHaveBeenCalledWith(eventId, 300);
    expect(contract.setEventCapacity.mock.invocationCallOrder[0]!).toBeLessThan(
      contract.mint.mock.invocationCallOrder[0]!,
    );
  });

  it("skips tickets already issued by a previous attempt", async () => {
    repository.findPurchase.mockResolvedValue(
      purchase({ tickets: [ticket("t1", "ISSUED"), ticket("t2")] }),
    );

    await service.mintPurchase("p");

    expect(contract.mint).toHaveBeenCalledTimes(1);
    expect(contract.mint).toHaveBeenCalledWith("t2", eventId, expect.any(String));
  });

  it.each([
    ["TICKET_ISSUED", "already_issued"],
    ["AWAITING_PAYMENT", "not_payable"],
    ["PAYMENT_FAILED", "not_payable"],
  ] as const)("does not mint a %s purchase", async (status, outcome) => {
    repository.findPurchase.mockResolvedValue(purchase({ status }));

    await expect(service.mintPurchase("p")).resolves.toBe(outcome);
    expect(contract.mint).not.toHaveBeenCalled();
  });

  it("fails the job for good on a contract rejection or missing data", async () => {
    contract.mint.mockRejectedValue(new TicketContractError("mint", 1002));
    await expect(service.mintPurchase("p")).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repository.completeIfIssued).not.toHaveBeenCalled();

    repository.buyerAddress.mockResolvedValue(null);
    await expect(service.mintPurchase("p")).rejects.toThrow("buyer_wallet_not_found");

    repository.findPurchase.mockResolvedValue(null);
    await expect(service.mintPurchase("p")).rejects.toThrow("purchase_not_found");
  });

  it("lets transient RPC failures be retried", async () => {
    const rpcError = new Error("socket hang up");
    contract.event.mockRejectedValue(rpcError);

    await expect(service.mintPurchase("p")).rejects.toBe(rpcError);
  });
});
