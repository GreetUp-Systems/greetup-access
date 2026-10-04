import { type MessageEvent, NotFoundException } from "@nestjs/common";

import { type UsersRepository } from "../users/users.repository";
import { purchaseStage, PurchaseStreamService } from "./purchase-stream.service";
import { type PurchaseRecord, type PurchasesRepository } from "./purchases.repository";

const principal = { privyUserId: "did:privy:buyer", sessionId: "session", accessToken: "jwt" };
const purchaseId = "00000000-0000-4000-8000-000000000001";
const timing = { pollMs: 1_000, heartbeatMs: 5_000, timeoutMs: 20_000 };

function record(status: PurchaseRecord["status"]): PurchaseRecord {
  return { id: purchaseId, status } as PurchaseRecord;
}

describe("PurchaseStreamService", () => {
  let find: jest.Mock;
  let service: PurchaseStreamService;

  beforeEach(() => {
    jest.useFakeTimers();
    find = jest.fn();
    const users = { findByPrivyUserId: jest.fn().mockResolvedValue({ id: "user-1" }) };
    service = new PurchaseStreamService(
      users as unknown as UsersRepository,
      { find } as unknown as PurchasesRepository,
      timing,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function collect(): Promise<{ events: MessageEvent[]; done: () => boolean }> {
    const events: MessageEvent[] = [];
    let completed = false;
    (await service.open(principal, purchaseId)).subscribe({
      next: (event) => events.push(event),
      complete: () => {
        completed = true;
      },
    });
    return { events, done: () => completed };
  }

  it("maps every purchase status to the buyer's stage", () => {
    expect(purchaseStage("initiated")).toBe("order_placed");
    expect(purchaseStage("awaiting_payment")).toBe("awaiting_payment");
    expect(purchaseStage("payment_confirmed")).toBe("payment_confirmed");
    expect(purchaseStage("ticket_issued")).toBe("ticket_issued");
    expect(purchaseStage("payment_failed")).toBe("not_completed");
    expect(purchaseStage("payment_refunded")).toBe("not_completed");
  });

  it("emits the stage on open and only on changes, then closes on a final stage", async () => {
    find
      .mockResolvedValueOnce(record("AWAITING_PAYMENT"))
      .mockResolvedValueOnce(record("AWAITING_PAYMENT"))
      .mockResolvedValueOnce(record("PAYMENT_CONFIRMED"))
      .mockResolvedValueOnce(record("TICKET_ISSUED"));
    const stream = await collect();

    for (let tick = 0; tick < 3; tick += 1) {
      await jest.advanceTimersByTimeAsync(timing.pollMs);
    }

    expect(stream.events.map((event) => (event.data as { stage: string }).stage)).toEqual([
      "awaiting_payment",
      "payment_confirmed",
      "ticket_issued",
    ]);
    expect(stream.events[0]).toEqual({
      type: "status",
      data: { purchaseId, stage: "awaiting_payment", status: "awaiting_payment" },
    });
    expect(stream.done()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("closes right away for a purchase already in a final stage", async () => {
    find.mockResolvedValueOnce(record("PAYMENT_REFUNDED"));
    const stream = await collect();

    expect(stream.events).toHaveLength(1);
    expect(stream.done()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("sends heartbeats, survives a failed read and ends with a timeout", async () => {
    find.mockResolvedValueOnce(record("AWAITING_PAYMENT")).mockRejectedValueOnce(new Error("db"));
    find.mockResolvedValue(record("AWAITING_PAYMENT"));
    const stream = await collect();

    await jest.advanceTimersByTimeAsync(timing.timeoutMs);

    const types = stream.events.map((event) => event.type);
    expect(types.filter((type) => type === "heartbeat")).toHaveLength(4);
    expect(types.at(-1)).toBe("timeout");
    expect(stream.done()).toBe(true);
  });

  it("answers 404 before opening the stream for an unknown purchase", async () => {
    find.mockResolvedValueOnce(null);
    await expect(service.open(principal, purchaseId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
