import type { ProducerEvent } from "../api/producer";
import {
  activeEventCount,
  eventPlace,
  eventStatus,
  eventTab,
  filterEvents,
  groupEvents,
  hasPublicPage,
  nextEvent,
  soldPercent,
} from "./events";

const now = new Date("2026-10-06T15:00:00Z");
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day).toISOString();

function event(overrides: Partial<ProducerEvent>): ProducerEvent {
  return {
    id: overrides.name ?? "id",
    slug: "slug",
    name: "Festival de Inverno",
    description: null,
    category: "festivals",
    coverUrl: null,
    venueName: "Casa Fluida",
    city: { code: 3550308, name: "São Paulo", uf: "SP" },
    address: null,
    startsAt: at(6),
    endsAt: null,
    capacity: 300,
    refundPolicy: null,
    status: "published",
    publishedAt: at(-10),
    cancelledAt: null,
    createdAt: at(-20),
    updatedAt: at(-10),
    soldTickets: 120,
    salesCents: 2_640_000,
    ...overrides,
  };
}

describe("eventTab", () => {
  it("keeps drafts apart, sells published events until they are over and ends the cancelled", () => {
    expect(eventTab(event({ status: "draft", startsAt: at(-3) }), now)).toBe("drafts");
    expect(eventTab(event({ startsAt: at(2) }), now)).toBe("on_sale");
    expect(eventTab(event({ startsAt: at(-1), endsAt: at(1) }), now)).toBe("on_sale");
    expect(eventTab(event({ startsAt: at(-2), endsAt: at(-1) }), now)).toBe("ended");
    expect(eventTab(event({ startsAt: at(-1) }), now)).toBe("ended");
    expect(eventTab(event({ status: "cancelled", startsAt: at(9) }), now)).toBe("ended");
  });
});

describe("eventStatus and hasPublicPage", () => {
  it("ends a published event that is over and keeps the other states", () => {
    expect(eventStatus(event({ startsAt: at(2) }), now)).toBe("published");
    expect(eventStatus(event({ startsAt: at(-2), endsAt: at(-1) }), now)).toBe("ended");
    expect(eventStatus(event({ startsAt: at(-1), endsAt: at(1) }), now)).toBe("published");
    expect(eventStatus(event({ status: "draft", startsAt: at(-3) }), now)).toBe("draft");
    expect(eventStatus(event({ status: "cancelled", startsAt: at(-3) }), now)).toBe("cancelled");
  });

  it("gives a page only to published events", () => {
    expect(hasPublicPage(event({}))).toBe(true);
    expect(hasPublicPage(event({ startsAt: at(-3) }))).toBe(true);
    expect(hasPublicPage(event({ status: "draft" }))).toBe(false);
    expect(hasPublicPage(event({ status: "cancelled" }))).toBe(false);
  });
});

describe("groupEvents and counts", () => {
  const events = [
    event({ name: "Depois", startsAt: at(40) }),
    event({ name: "Logo", startsAt: at(3) }),
    event({ name: "Rascunho", status: "draft", startsAt: at(20) }),
    event({ name: "Passado", startsAt: at(-30) }),
    event({ name: "Ontem", startsAt: at(-1) }),
    event({ name: "Cancelado", status: "cancelled", startsAt: at(9) }),
  ];

  it("sorts the upcoming tabs from the soonest and the ended one from the latest", () => {
    const groups = groupEvents(events, now);
    expect(groups.on_sale.map((e) => e.name)).toEqual(["Logo", "Depois"]);
    expect(groups.drafts.map((e) => e.name)).toEqual(["Rascunho"]);
    expect(groups.ended.map((e) => e.name)).toEqual(["Cancelado", "Ontem", "Passado"]);
  });

  it("counts what is on sale and the drafts beside Eventos", () => {
    expect(activeEventCount(events, now)).toBe(3);
    expect(activeEventCount([], now)).toBe(0);
  });

  it("picks the published event that starts next", () => {
    expect(nextEvent(events, now)?.name).toBe("Logo");
    expect(nextEvent([event({ status: "draft" })], now)).toBeNull();
  });
});

describe("filterEvents", () => {
  const events = [event({ name: "Noite de Jazz" }), event({ name: "Ação Solidária" })];

  it("matches part of the name without case or accents, and keeps all for an empty search", () => {
    expect(filterEvents(events, "jazz").map((e) => e.name)).toEqual(["Noite de Jazz"]);
    expect(filterEvents(events, "  ACAO ").map((e) => e.name)).toEqual(["Ação Solidária"]);
    expect(filterEvents(events, "")).toHaveLength(2);
    expect(filterEvents(events, "rock")).toEqual([]);
  });
});

describe("soldPercent and eventPlace", () => {
  it("rounds sold over capacity and caps it at 100", () => {
    expect(soldPercent({ soldTickets: 120, capacity: 300 })).toBe(40);
    expect(soldPercent({ soldTickets: 310, capacity: 300 })).toBe(100);
    expect(soldPercent({ soldTickets: 0, capacity: 0 })).toBe(0);
  });

  it("joins the venue and the city that exist", () => {
    expect(eventPlace(event({}))).toBe("Casa Fluida · São Paulo");
    expect(eventPlace(event({ venueName: null }))).toBe("São Paulo");
    expect(eventPlace(event({ city: null }))).toBe("Casa Fluida");
    expect(eventPlace(event({ venueName: null, city: null }))).toBeNull();
  });
});
