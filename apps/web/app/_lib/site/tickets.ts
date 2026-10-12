import type { TicketView } from "../api/tickets";
import { formatDaysUntil, formatEventStart, formatShortDate } from "../format";
import { eventPlace, isOver } from "../producer/events";

type TicketEvent = TicketView["event"];

/** Próximos and Anteriores (SPEC-014 M2); Anteriores lives in the URL as `?aba=anteriores`. */
export type TicketsTab = "upcoming" | "past";

/** The tab of `?aba=`; anything else opens Próximos. */
export function ticketsTab(aba: string | string[] | undefined): TicketsTab {
  return aba === "anteriores" ? "past" : "upcoming";
}

export function ticketsHref(tab: TicketsTab): string {
  return tab === "past" ? "/me/tickets?aba=anteriores" : "/me/tickets";
}

/**
 * Anterior: the event was cancelled, or its end (without an end, its start) has passed, the rule
 * of the producer's Eventos tabs (SPEC-014 M2).
 */
export function isPastEvent(event: TicketEvent, now: Date): boolean {
  return event.status === "cancelled" || isOver(event, now);
}

/** The opened ticket goes back to its event's tab (SPEC-014 M8). */
export function backHref(event: TicketEvent, now: Date): string {
  return ticketsHref(isPastEvent(event, now) ? "past" : "upcoming");
}

export interface EventTickets {
  event: TicketEvent;
  /** By issuance, the ones still being issued last: the first is what the card opens (M1, M7). */
  tickets: TicketView[];
}

const issuance = (ticket: TicketView) =>
  ticket.issuedAt === null ? Number.POSITIVE_INFINITY : new Date(ticket.issuedAt).getTime();

/** One card per event (M1), its tickets by issuance; the API order breaks ties. */
export function groupByEvent(tickets: readonly TicketView[]): EventTickets[] {
  const groups = new Map<string, EventTickets>();
  for (const ticket of tickets) {
    const group = groups.get(ticket.event.id);
    if (group === undefined) {
      groups.set(ticket.event.id, { event: ticket.event, tickets: [ticket] });
    } else {
      group.tickets.push(ticket);
    }
  }
  for (const group of groups.values()) {
    group.tickets.sort((a, b) => issuance(a) - issuance(b));
  }
  return [...groups.values()];
}

const byStart = (a: EventTickets, b: EventTickets) =>
  new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime();

/** Próximos from the soonest; Anteriores from the most recent (M2). */
export function splitByTab(
  groups: readonly EventTickets[],
  now: Date,
): Record<TicketsTab, EventTickets[]> {
  const tabs: Record<TicketsTab, EventTickets[]> = { upcoming: [], past: [] };
  for (const group of groups) {
    tabs[isPastEvent(group.event, now) ? "past" : "upcoming"].push(group);
  }
  tabs.upcoming.sort(byStart);
  tabs.past.sort((a, b) => byStart(b, a));
  return tabs;
}

/** "1 ingresso", "2 ingressos". */
export function ticketCount(count: number): string {
  return count === 1 ? "1 ingresso" : `${count} ingressos`;
}

/** The type's badge only when every ticket of the event is of that type (M1). */
export function sharedTicketType(tickets: readonly TicketView[]): string | null {
  const [first] = tickets;
  if (first === undefined) {
    return null;
  }
  return tickets.every((ticket) => ticket.ticketType.id === first.ticketType.id)
    ? first.ticketType.name
    : null;
}

/** "1 ingresso · Pista" under a row, or just the count when the types differ. */
export function ticketsLine(tickets: readonly TicketView[]): string {
  const type = sharedTicketType(tickets);
  const count = ticketCount(tickets.length);
  return type === null ? count : `${count} · ${type}`;
}

/**
 * The countdown of an upcoming event (M6): "Em N dias", "Amanhã" and "Hoje" by Brasília's calendar,
 * and "Agora" from the start to the end (an event that started without an end is already Anterior).
 */
export function countdown(event: TicketEvent, now: Date): string {
  return new Date(event.startsAt).getTime() <= now.getTime()
    ? "Agora"
    : formatDaysUntil(event.startsAt, now);
}

/** The card's state (M3): cancelled, past and not cancelled (faded, no badge), or upcoming. */
export function cardState(event: TicketEvent, now: Date): "default" | "past" | "cancelled" {
  if (event.status === "cancelled") {
    return "cancelled";
  }
  return isOver(event, now) ? "past" : "default";
}

/**
 * The Ingresso's state (M3): a cancelled event cancels the ticket, even one still being issued and
 * even if the API sent a token; past and not cancelled, it stays Válido.
 */
export function ticketState(ticket: TicketView): "valid" | "issuing" | "cancelled" {
  if (ticket.event.status === "cancelled") {
    return "cancelled";
  }
  return ticket.status === "issued" ? "valid" : "issuing";
}

const present = (part: string | null | undefined): part is string =>
  typeof part === "string" && part !== "";

/** "Casa Fluida · São Paulo": the card, the phone highlight and the Ingresso (M9). */
export function venueAndCity(event: TicketEvent): string | null {
  return eventPlace(event);
}

/** "Casa Fluida · Rua Augusta, 1200, São Paulo": the desktop's wide highlight (M9). */
export function venueAndAddress(event: TicketEvent): string | null {
  const address = [event.address, event.city?.name].filter(present).join(", ");
  const parts = [event.venueName, address].filter(present);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** "Qui, 5 nov · Rio de Janeiro": a row on the phone and an Anteriores card (M9). */
export function dateAndCity(event: TicketEvent): string {
  return [formatShortDate(event.startsAt), event.city?.name].filter(present).join(" · ");
}

/** "Seg, 12 de outubro, 21h · Casa Fluida, São Paulo": under the opened ticket's title (M9). */
export function eventDetail(event: TicketEvent): string {
  const place = [event.venueName, event.city?.name].filter(present).join(", ");
  return [formatEventStart(event.startsAt), place].filter(present).join(" · ");
}

/** "Seu ingresso", "Seus 3 ingressos": above the list of the opened ticket. */
export function ticketsHeading(count: number): string {
  return count === 1 ? "Seu ingresso" : `Seus ${count} ingressos`;
}

/** "Ingresso 1 de 3 · deslize para ver os outros" under the phone's carousel; none for one. */
export function swipeCaption(index: number, count: number): string | null {
  if (count <= 1) {
    return null;
  }
  return `Ingresso ${index + 1} de ${count} · deslize para ver ${count === 2 ? "o outro" : "os outros"}`;
}

/** "Ingresso 1 · Pista" and "Código AX-0042" in the desktop list. */
export function ticketItem(ticket: TicketView, position: number): { title: string; code: string } {
  return {
    title: `Ingresso ${position} · ${ticket.ticketType.name}`,
    code: `Código ${ticket.code ?? "AX-····"}`,
  };
}
