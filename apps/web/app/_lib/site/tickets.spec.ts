import type { TicketView } from "../api/tickets";
import {
  backHref,
  cardState,
  countdown,
  dateAndCity,
  eventDetail,
  groupByEvent,
  sharedTicketType,
  splitByTab,
  swipeCaption,
  ticketCount,
  ticketItem,
  ticketsHeading,
  ticketsLine,
  ticketState,
  ticketsTab,
  venueAndAddress,
  venueAndCity,
} from "./tickets";

// Wednesday, 07/10/2026, 10h in Brasília.
const now = new Date("2026-10-07T13:00:00.000Z");

type EventOverrides = Partial<TicketView["event"]>;

function event(id: string, overrides: EventOverrides = {}): TicketView["event"] {
  return {
    id,
    slug: id,
    name: `Evento ${id}`,
    status: "published",
    startsAt: "2026-10-12T00:00:00.000Z",
    endsAt: null,
    venueName: "Casa Fluida",
    address: "Rua Augusta, 1200",
    coverUrl: null,
    city: { code: 3550308, name: "São Paulo", uf: "SP" },
    ...overrides,
  };
}

let sequence = 0;

function ticket(
  ev: TicketView["event"],
  overrides: Partial<Omit<TicketView, "event">> = {},
): TicketView {
  sequence += 1;
  return {
    id: `t${sequence}`,
    status: "issued",
    code: `AX-${String(sequence).padStart(4, "0")}`,
    event: ev,
    ticketType: { id: "pista", name: "Pista" },
    purchaseId: "p1",
    issuedAt: "2026-10-01T12:00:00.000Z",
    onchain: null,
    ...overrides,
  };
}

describe("ticketsTab", () => {
  it("opens Anteriores only for ?aba=anteriores and Próximos for anything else", () => {
    expect(ticketsTab("anteriores")).toBe("past");
    expect(ticketsTab(undefined)).toBe("upcoming");
    expect(ticketsTab("proximos")).toBe("upcoming");
    expect(ticketsTab("ANTERIORES")).toBe("upcoming");
    expect(ticketsTab(["anteriores", "x"])).toBe("upcoming");
  });
});

describe("splitByTab", () => {
  const soon = event("soon", { startsAt: "2026-10-09T23:00:00.000Z" });
  const later = event("later", { startsAt: "2026-11-05T23:00:00.000Z" });
  const running = event("running", {
    startsAt: "2026-10-07T12:00:00.000Z",
    endsAt: "2026-10-07T20:00:00.000Z",
  });
  const startedNoEnd = event("started", { startsAt: "2026-10-07T12:59:00.000Z" });
  const ended = event("ended", {
    startsAt: "2026-09-01T22:00:00.000Z",
    endsAt: "2026-09-02T03:00:00.000Z",
  });
  const older = event("older", { startsAt: "2026-05-09T22:00:00.000Z" });
  const cancelledFuture = event("cancelled", {
    status: "cancelled",
    startsAt: "2026-12-01T22:00:00.000Z",
  });
  const draft = event("draft", { status: "draft", startsAt: "2026-12-10T22:00:00.000Z" });

  const groups = groupByEvent(
    [later, older, soon, cancelledFuture, ended, running, startedNoEnd, draft].map((ev) =>
      ticket(ev),
    ),
  );
  const tabs = splitByTab(groups, now);
  const ids = (list: typeof tabs.upcoming) => list.map((group) => group.event.id);

  it("keeps upcoming and running events in Próximos, from the soonest", () => {
    expect(ids(tabs.upcoming)).toEqual(["running", "soon", "later", "draft"]);
  });

  it("puts cancelled, ended and started-without-an-end events in Anteriores, latest first", () => {
    expect(ids(tabs.past)).toEqual(["cancelled", "started", "ended", "older"]);
  });
});

describe("groupByEvent", () => {
  it("groups by event, not by neighbours, even with the same start", () => {
    const a = event("a", { startsAt: "2026-10-12T00:00:00.000Z" });
    const b = event("b", { startsAt: "2026-10-12T00:00:00.000Z" });
    const groups = groupByEvent([ticket(a), ticket(b), ticket(a)]);
    expect(groups.map((group) => [group.event.id, group.tickets.length])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("orders each event's tickets by issuance, the ones being issued last", () => {
    const ev = event("e");
    const pending = ticket(ev, { status: "pending_mint", code: null, issuedAt: null });
    const second = ticket(ev, { issuedAt: "2026-10-02T12:00:00.000Z" });
    const first = ticket(ev, { issuedAt: "2026-10-01T12:00:00.000Z" });
    const [group] = groupByEvent([pending, second, first]);
    expect(group?.tickets.map((t) => t.id)).toEqual([first.id, second.id, pending.id]);
  });

  it("keeps the API order between tickets still being issued", () => {
    const ev = event("e");
    const a = ticket(ev, { status: "pending_mint", code: null, issuedAt: null });
    const b = ticket(ev, { status: "pending_mint", code: null, issuedAt: null });
    expect(groupByEvent([a, b])[0]?.tickets.map((t) => t.id)).toEqual([a.id, b.id]);
  });
});

describe("counts and the type badge", () => {
  it("counts in Portuguese", () => {
    expect(ticketCount(1)).toBe("1 ingresso");
    expect(ticketCount(3)).toBe("3 ingressos");
  });

  it("shows the type only when every ticket shares it, compared by type and not by name", () => {
    const ev = event("e");
    const pista = ticket(ev);
    const vip = ticket(ev, { ticketType: { id: "vip", name: "VIP" } });
    const otherPista = ticket(ev, { ticketType: { id: "pista-2", name: "Pista" } });
    expect(sharedTicketType([pista, ticket(ev)])).toBe("Pista");
    expect(sharedTicketType([pista, vip])).toBeNull();
    expect(sharedTicketType([pista, otherPista])).toBeNull();
    expect(sharedTicketType([])).toBeNull();
    expect(ticketsLine([pista])).toBe("1 ingresso · Pista");
    expect(ticketsLine([pista, vip])).toBe("2 ingressos");
  });
});

describe("countdown", () => {
  it("counts calendar days in Brasília and says Agora while the event runs", () => {
    expect(countdown(event("e", { startsAt: "2026-10-12T00:00:00.000Z" }), now)).toBe("Em 4 dias");
    expect(countdown(event("e", { startsAt: "2026-10-09T03:00:00.000Z" }), now)).toBe("Em 2 dias");
    expect(countdown(event("e", { startsAt: "2026-10-09T02:59:00.000Z" }), now)).toBe("Amanhã");
    expect(countdown(event("e", { startsAt: "2026-10-08T23:00:00.000Z" }), now)).toBe("Amanhã");
    expect(countdown(event("e", { startsAt: "2026-10-07T23:00:00.000Z" }), now)).toBe("Hoje");
    expect(
      countdown(
        event("e", { startsAt: "2026-10-06T22:00:00.000Z", endsAt: "2026-10-08T03:00:00.000Z" }),
        now,
      ),
    ).toBe("Agora");
  });

  it("turns at midnight in Brasília, not in UTC", () => {
    // 23h30 in Brasília; the event starts at 0h30 of the next day (03h30 UTC).
    const lateNight = new Date("2026-10-08T02:30:00.000Z");
    expect(countdown(event("e", { startsAt: "2026-10-08T03:30:00.000Z" }), lateNight)).toBe(
      "Amanhã",
    );
    // 23h of the 8th in Brasília is already the 9th in UTC.
    expect(countdown(event("e", { startsAt: "2026-10-09T02:00:00.000Z" }), now)).toBe("Amanhã");
  });
});

describe("states", () => {
  it("cancels the card and the ticket of a cancelled event, issued or not", () => {
    const cancelled = event("c", { status: "cancelled", startsAt: "2026-12-01T22:00:00.000Z" });
    expect(cardState(cancelled, now)).toBe("cancelled");
    expect(ticketState(ticket(cancelled))).toBe("cancelled");
    expect(ticketState(ticket(cancelled, { status: "pending_mint", code: null }))).toBe(
      "cancelled",
    );
  });

  it("fades a past card and keeps its ticket valid", () => {
    const past = event("p", { startsAt: "2026-09-01T22:00:00.000Z" });
    expect(cardState(past, now)).toBe("past");
    expect(ticketState(ticket(past))).toBe("valid");
  });

  it("shows an upcoming ticket as issuing until it is issued", () => {
    const upcoming = event("u");
    expect(cardState(upcoming, now)).toBe("default");
    expect(ticketState(ticket(upcoming, { status: "pending_mint", code: null }))).toBe("issuing");
    expect(ticketState(ticket(upcoming))).toBe("valid");
  });

  it("goes back to the event's tab", () => {
    expect(backHref(event("u"), now)).toBe("/me/tickets");
    expect(backHref(event("p", { startsAt: "2026-09-01T22:00:00.000Z" }), now)).toBe(
      "/me/tickets?aba=anteriores",
    );
    expect(backHref(event("c", { status: "cancelled" }), now)).toBe("/me/tickets?aba=anteriores");
  });
});

describe("place per surface", () => {
  const full = event("e", { startsAt: "2026-11-06T23:00:00.000Z" });

  it("writes each surface as the Figma does", () => {
    expect(venueAndCity(full)).toBe("Casa Fluida · São Paulo");
    expect(venueAndAddress(full)).toBe("Casa Fluida · Rua Augusta, 1200, São Paulo");
    expect(dateAndCity(full)).toBe("Sex, 6 nov · São Paulo");
    expect(eventDetail(full)).toBe("Sex, 6 de novembro, 20h · Casa Fluida, São Paulo");
  });

  it("leaves out what is missing", () => {
    const bare = event("e", {
      startsAt: "2026-11-06T23:00:00.000Z",
      venueName: null,
      address: null,
      city: null,
    });
    expect(venueAndCity(bare)).toBeNull();
    expect(venueAndAddress(bare)).toBeNull();
    expect(dateAndCity(bare)).toBe("Sex, 6 nov");
    expect(eventDetail(bare)).toBe("Sex, 6 de novembro, 20h");
    const noCity = event("e", { city: null });
    expect(venueAndCity(noCity)).toBe("Casa Fluida");
    expect(venueAndAddress(noCity)).toBe("Casa Fluida · Rua Augusta, 1200");
    expect(venueAndAddress(event("e", { venueName: null }))).toBe("Rua Augusta, 1200, São Paulo");
  });
});

describe("opened ticket texts", () => {
  it("names the list and the swipe in the singular and the plural", () => {
    expect(ticketsHeading(1)).toBe("Seu ingresso");
    expect(ticketsHeading(3)).toBe("Seus 3 ingressos");
    expect(swipeCaption(0, 1)).toBeNull();
    expect(swipeCaption(0, 2)).toBe("Ingresso 1 de 2 · deslize para ver o outro");
    expect(swipeCaption(2, 3)).toBe("Ingresso 3 de 3 · deslize para ver os outros");
  });

  it("writes the item and its code, with dots while it is issued", () => {
    const ev = event("e");
    expect(ticketItem(ticket(ev, { code: "AX-0042" }), 1)).toEqual({
      title: "Ingresso 1 · Pista",
      code: "Código AX-0042",
    });
    expect(ticketItem(ticket(ev, { code: null, status: "pending_mint" }), 2)).toEqual({
      title: "Ingresso 2 · Pista",
      code: "Código AX-····",
    });
  });
});
