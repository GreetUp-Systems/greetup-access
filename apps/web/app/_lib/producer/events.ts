import type { ProducerEvent } from "../api/producer";

/** The tabs of the event lists (SPEC-015 §6): À venda, Rascunhos and Encerrados. */
export type EventTab = "on_sale" | "drafts" | "ended";

export const eventTabs: ReadonlyArray<{ tab: EventTab; label: string }> = [
  { tab: "on_sale", label: "À venda" },
  { tab: "drafts", label: "Rascunhos" },
  { tab: "ended", label: "Encerrados" },
];

/** Over when its end, or its start without an end, is in the past. */
export function isOver(event: ProducerEvent, now: Date): boolean {
  return new Date(event.endsAt ?? event.startsAt).getTime() < now.getTime();
}

/**
 * A draft stays a draft; a published event is on sale until it is over; a cancelled event is no
 * longer on sale and joins the ended ones (cancelling is out of the interface, P6, but the API has it).
 */
export function eventTab(event: ProducerEvent, now: Date): EventTab {
  if (event.status === "draft") {
    return "drafts";
  }
  if (event.status === "cancelled" || isOver(event, now)) {
    return "ended";
  }
  return "on_sale";
}

/**
 * The Status of a row: a published event that is over shows "Encerrado"; a cancelled one keeps
 * "Cancelado", in the same tab.
 */
export function eventStatus(
  event: ProducerEvent,
  now: Date,
): "draft" | "published" | "ended" | "cancelled" {
  if (event.status === "published" && isOver(event, now)) {
    return "ended";
  }
  return event.status;
}

/** Ver página and Copiar link exist for a published event, over or not (its page stays). */
export function hasPublicPage(event: ProducerEvent): boolean {
  return event.status === "published";
}

const byStart = (a: ProducerEvent, b: ProducerEvent) =>
  new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

/** Upcoming tabs from the soonest; the ended one from the most recent. */
export function groupEvents(
  events: readonly ProducerEvent[],
  now: Date,
): Record<EventTab, ProducerEvent[]> {
  const groups: Record<EventTab, ProducerEvent[]> = { on_sale: [], drafts: [], ended: [] };
  for (const event of events) {
    groups[eventTab(event, now)].push(event);
  }
  groups.on_sale.sort(byStart);
  groups.drafts.sort(byStart);
  groups.ended.sort((a, b) => byStart(b, a));
  return groups;
}

/** The count beside "Eventos" in the navigation: what is on sale plus the drafts. */
export function activeEventCount(events: readonly ProducerEvent[], now: Date): number {
  return events.filter((event) => eventTab(event, now) !== "ended").length;
}

/** The published event that starts next, or null. */
export function nextEvent(events: readonly ProducerEvent[], now: Date): ProducerEvent | null {
  return (
    events
      .filter(
        (event) =>
          event.status === "published" && new Date(event.startsAt).getTime() > now.getTime(),
      )
      .sort(byStart)[0] ?? null
  );
}

const searchable = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();

/** The search of the lists, in the browser: by name, without accents (SPEC-015 §6). */
export function filterEvents(events: readonly ProducerEvent[], query: string): ProducerEvent[] {
  const term = searchable(query);
  return term === ""
    ? [...events]
    : events.filter((event) => searchable(event.name).includes(term));
}

/** Sold over capacity, 0 to 100, for Progresso. */
export function soldPercent(event: Pick<ProducerEvent, "soldTickets" | "capacity">): number {
  if (event.capacity <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((event.soldTickets / event.capacity) * 100));
}

/** "Casa Fluida · São Paulo": the place under the event's name. */
export function eventPlace(event: Pick<ProducerEvent, "venueName" | "city">): string | null {
  const parts = [event.venueName, event.city?.name].filter(
    (part): part is string => typeof part === "string" && part !== "",
  );
  return parts.length === 0 ? null : parts.join(" · ");
}
