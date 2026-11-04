import type { EventDetail } from "../api/producer-events";
import { formatShortDate, formatShortDayMonth } from "../format";
import { categoryLabels, cityLabel } from "./event-form";
import { isoToBrasilia } from "./event-schedule";
import { seatsInTypes } from "./ticket-types";

// The event page's summary by section (SPEC-015 §6, E5; Figma 591:12579 and 591:12345): each
// section in a line with "Editar", which opens it at `?editar=<seção>`.

export const eventSections = [
  "nome",
  "data",
  "capacidade",
  "local",
  "capa",
  "ingressos",
  "descricao",
] as const;
export type EventSection = (typeof eventSections)[number];

/** `?editar=` as a section, or null for anything else. */
export function parseSection(value: string | null): EventSection | null {
  return eventSections.find((section) => section === value) ?? null;
}

/** The title of a section, in its line and on its edit card. */
export const sectionTitles: Record<EventSection, string> = {
  nome: "Nome e categoria",
  data: "Data e horário",
  capacidade: "Capacidade",
  local: "Local",
  capa: "Capa",
  ingressos: "Tipos de ingresso",
  descricao: "Descrição e reembolso",
};

export interface SectionSummary {
  text: string;
  /** What is missing to publish: the line is a warning (Publicar bloqueado, 595:13914). */
  missing: boolean;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** "Falta enviar · obrigatória para publicar": the empty sections the publication needs. */
const requiredForPublishing = (missing: string, gender: "a" | "o"): SectionSummary => ({
  text: `${missing} · obrigatóri${gender} para publicar`,
  missing: true,
});

/**
 * "Seg, 12 out · 21:00 às 02:00": the start and the end's time; an end after the next day also
 * says its day.
 */
export function scheduleSummary(event: Pick<EventDetail, "startsAt" | "endsAt">): string {
  const start = isoToBrasilia(event.startsAt);
  const day = `${formatShortDate(event.startsAt)} · ${start.time}`;
  if (event.endsAt === null) {
    return day;
  }
  const end = isoToBrasilia(event.endsAt);
  const nextDay = isoToBrasilia(
    new Date(Date.parse(event.startsAt) + 24 * 60 * 60 * 1000).toISOString(),
  ).date;
  const near = end.date === start.date || end.date === nextDay;
  return near
    ? `${day} às ${end.time}`
    : `${day} às ${formatShortDayMonth(event.endsAt)}, ${end.time}`;
}

/** "2 tipos · 150 de 300 lugares". */
export function ticketTypesSummary(event: Pick<EventDetail, "ticketTypes" | "capacity">): string {
  return `${plural(event.ticketTypes.length, "tipo", "tipos")} · ${seatsInTypes(event.ticketTypes)} de ${event.capacity} lugares`;
}

/**
 * The line under a section's title. An empty section says what is missing, and one the
 * publication needs adds "obrigatória para publicar" (SPEC-015 §6).
 */
export function sectionSummary(section: EventSection, event: EventDetail): SectionSummary {
  switch (section) {
    case "nome":
      return event.category === null
        ? requiredForPublishing("Falta escolher a categoria", "a")
        : { text: `${event.name} · ${categoryLabels[event.category]}`, missing: false };
    case "data":
      return { text: scheduleSummary(event), missing: false };
    case "capacidade":
      return { text: plural(event.capacity, "pessoa", "pessoas"), missing: false };
    case "local":
      if (event.city === null) {
        return requiredForPublishing("Falta escolher a cidade", "a");
      }
      return {
        text: [event.venueName, cityLabel(event.city)].filter((part) => part !== null).join(" · "),
        missing: false,
      };
    case "capa":
      return event.coverUrl === null
        ? requiredForPublishing("Falta enviar", "a")
        : { text: "Enviada", missing: false };
    case "ingressos":
      return event.ticketTypes.length === 0
        ? requiredForPublishing("Falta adicionar um tipo", "o")
        : { text: ticketTypesSummary(event), missing: false };
    case "descricao": {
      const text = event.refundPolicy ?? event.description;
      return text === null ? { text: "Falta escrever", missing: false } : { text, missing: false };
    }
  }
}
