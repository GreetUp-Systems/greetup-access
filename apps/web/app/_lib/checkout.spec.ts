import { ApiError } from "./api/client";
import { type PurchaseView } from "./api/purchases";
import { changedPurchase, creationNotice, orderDescription, pixNotice } from "./checkout";

const apiError = (status: number, code: string, body: unknown = null) =>
  new ApiError(status, code, code, body);

const purchase: PurchaseView = {
  id: "p1",
  status: "initiated",
  eventId: "e1",
  ticketTypeId: "t1",
  event: {
    slug: "festival-de-inverno",
    name: "Festival de Inverno",
    startsAt: "2026-11-07T00:00:00.000Z",
    endsAt: null,
    venueName: "Casa Fluida",
    address: null,
  },
  ticketType: { id: "t1", name: "Pista" },
  quantity: 2,
  unitPriceCents: 12_000,
  subtotalCents: 24_000,
  serviceFeeCents: 2_520,
  totalCents: 26_520,
  pixCode: null,
  createdAt: "2026-10-05T12:00:00.000Z",
  tickets: [],
};

describe("creationNotice", () => {
  it.each([
    ["purchase_below_minimum", "below_minimum"],
    ["purchase_above_maximum", "above_maximum"],
    ["ticket_type_sold_out", "sold_out"],
    ["event_not_on_sale", "event_closed"],
    ["producer_not_ready_for_sales", "failed"],
    ["ticket_type_not_available", "failed"],
  ])("maps %s to %s", (code, notice) => {
    expect(creationNotice(apiError(409, code))).toBe(notice);
  });

  it("treats a network failure or anything else as a failure to continue", () => {
    expect(creationNotice(apiError(0, "network_error"))).toBe("failed");
    expect(creationNotice(new Error("boom"))).toBe("failed");
  });
});

describe("pixNotice", () => {
  it.each([
    ["purchase_total_changed", "total_changed"],
    ["purchase_expired", "expired"],
    ["payment_rejected", "not_completed"],
    ["purchase_not_payable", "not_completed"],
    ["purchase_below_minimum", "below_minimum"],
    ["purchase_above_maximum", "above_maximum"],
    ["payment_provider_unavailable", "connection"],
    ["network_error", "connection"],
  ])("maps %s to %s", (code, notice) => {
    expect(pixNotice(apiError(409, code))).toBe(notice);
  });
});

describe("changedPurchase", () => {
  it("reads the new total that comes with purchase_total_changed", () => {
    const updated = { ...purchase, totalCents: 26_700 };
    expect(changedPurchase(apiError(409, "purchase_total_changed", { purchase: updated }))).toBe(
      updated,
    );
    expect(changedPurchase(apiError(409, "purchase_expired", { purchase: updated }))).toBeNull();
    expect(changedPurchase(apiError(409, "purchase_total_changed", null))).toBeNull();
  });
});

describe("orderDescription", () => {
  it("says the event, the quantity and the ticket type", () => {
    expect(orderDescription(purchase)).toBe("Festival de Inverno · 2 × Pista");
  });
});
