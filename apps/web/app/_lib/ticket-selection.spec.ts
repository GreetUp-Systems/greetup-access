import type { PublicTicketType } from "./api/events";
import {
  clampQuantity,
  defaultTicketType,
  maxQuantity,
  saleState,
  startingPrice,
} from "./ticket-selection";

const type = (id: string, priceCents: number, available: number): PublicTicketType => ({
  id,
  name: id,
  description: null,
  priceCents,
  available,
});

describe("saleState", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("sells a published event that has not started", () => {
    expect(saleState({ status: "published", startsAt: "2026-10-11T00:00:00.000Z" }, now)).toBe(
      "on_sale",
    );
  });

  it("stops at the start and for a cancelled event", () => {
    expect(saleState({ status: "published", startsAt: "2026-10-05T12:00:00.000Z" }, now)).toBe(
      "started",
    );
    expect(saleState({ status: "cancelled", startsAt: "2026-10-11T00:00:00.000Z" }, now)).toBe(
      "cancelled",
    );
  });
});

describe("startingPrice", () => {
  it("uses the cheapest available type", () => {
    expect(startingPrice([type("vip", 9_000, 30), type("meia", 6_000, 0), type("pista", 8_000, 1)])).toBe(
      8_000,
    );
  });

  it("falls back to every type when all are sold out, and is null without types", () => {
    expect(startingPrice([type("vip", 9_000, 0), type("pista", 8_000, 0)])).toBe(8_000);
    expect(startingPrice([])).toBeNull();
  });
});

describe("defaultTicketType", () => {
  it("picks the first type that can be bought", () => {
    expect(defaultTicketType([type("a", 6_000, 0), type("b", 6_000, 2)])?.id).toBe("b");
    expect(defaultTicketType([type("a", 6_000, 0)])).toBeNull();
  });
});

describe("quantity", () => {
  it("caps at 10 and at what is available", () => {
    expect(maxQuantity(type("a", 6_000, 120))).toBe(10);
    expect(maxQuantity(type("a", 6_000, 3))).toBe(3);
    expect(maxQuantity(null)).toBe(0);
  });

  it("keeps the counter between 1 and the cap", () => {
    expect(clampQuantity(0, type("a", 6_000, 3))).toBe(1);
    expect(clampQuantity(5, type("a", 6_000, 3))).toBe(3);
    expect(clampQuantity(2, type("a", 6_000, 0))).toBe(0);
  });
});
