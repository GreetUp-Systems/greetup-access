import type { City, EventCategory } from "../api/producer";
import type { CreateEventInput, EventDetail, UpdateEventInput } from "../api/producer-events";
import {
  emptySchedule,
  type ScheduleFields,
  scheduleFromEvent,
  scheduleProblems,
  scheduleToIso,
} from "./event-schedule";
import { seatsInTypes } from "./ticket-types";

// The fields of an event as the producer fills them (SPEC-015 §6, E4): the draft's three passos
// (name and category, date and time, capacity) and the details' location and texts, checked when
// leaving a field and on "Continuar", and turned into what the API takes.

/** The categories in the order of the screen (SPEC-015 E2, Figma 586:11098). */
export const categoryLabels: Record<EventCategory, string> = {
  shows: "Shows",
  parties: "Festas",
  theater: "Teatro",
  standup: "Stand-up",
  sports: "Esportes",
  festivals: "Festivais",
  kids: "Infantil",
  courses: "Cursos",
  food: "Gastronomia",
};

/** The draft as typed in its three passos; kept in the page's memory until "Criar rascunho". */
export interface DraftForm extends ScheduleFields {
  name: string;
  category: EventCategory | null;
  /** Digits only (maskWholeNumber). */
  capacity: string;
}

export const emptyDraft: DraftForm = {
  name: "",
  category: null,
  ...emptySchedule,
  capacity: "",
};

/** The messages of the event's fields (SPEC-015 §6). */
export const eventMessages = {
  name: "Escreva o nome do evento.",
  category: "Escolha uma categoria.",
  capacity: "Informe quantas pessoas o evento comporta.",
  /** A published event: the capacity never goes below the ticket types. */
  capacityBelowTypes: (seats: number) =>
    `Os tipos já somam ${seats} lugares. Use ${seats} ou mais.`,
} as const;

export type DraftField = keyof DraftForm;

/** Passo 1, Nome e categoria. */
export function nameProblems(
  form: Pick<DraftForm, "name" | "category">,
): Partial<Record<"name" | "category", string>> {
  const problems: Partial<Record<"name" | "category", string>> = {};
  if (form.name.trim() === "") {
    problems.name = eventMessages.name;
  }
  if (form.category === null) {
    problems.category = eventMessages.category;
  }
  return problems;
}

/**
 * Passo 3, Capacidade: a whole number from 1; `minimum` is the seats of the types, which a
 * published event's capacity never goes below (SPEC-004 §5).
 */
export function capacityProblem(value: string, minimum = 0): string | null {
  const capacity = Number(value);
  if (value.trim() === "" || !Number.isInteger(capacity) || capacity < 1) {
    return eventMessages.capacity;
  }
  return capacity < minimum ? eventMessages.capacityBelowTypes(minimum) : null;
}

/** The problems of one passo of the draft, by field. */
export function draftPassoProblems(
  form: DraftForm,
  passo: number,
  now: Date = new Date(),
): Partial<Record<DraftField, string>> {
  if (passo === 1) {
    return nameProblems(form);
  }
  if (passo === 2) {
    return scheduleProblems(form, now);
  }
  const capacity = capacityProblem(form.capacity);
  return capacity === null ? {} : { capacity };
}

/** How many passos of the draft are right, in a row (0 to 3). */
export function draftPassosDone(form: DraftForm, now: Date = new Date()): number {
  let done = 0;
  for (const passo of [1, 2, 3]) {
    if (Object.keys(draftPassoProblems(form, passo, now)).length > 0) {
      break;
    }
    done += 1;
  }
  return done;
}

/** "Criar rascunho": the draft's three passos, once they are right. */
export function createEventInput(form: DraftForm, now: Date = new Date()): CreateEventInput | null {
  const schedule = scheduleToIso(form);
  if (draftPassosDone(form, now) < 3 || schedule === null || form.category === null) {
    return null;
  }
  return {
    name: form.name.trim(),
    category: form.category,
    startsAt: schedule.startsAt,
    ...(schedule.endsAt === null ? {} : { endsAt: schedule.endsAt }),
    capacity: Number(form.capacity),
  };
}

/** The draft's fields of an event, to edit them or to go back to the creation. */
export function draftFromEvent(event: EventDetail): DraftForm {
  return {
    name: event.name,
    category: event.category,
    ...scheduleFromEvent(event),
    capacity: String(event.capacity),
  };
}

/**
 * Only what changed in the draft's fields (the last passo of the creation after the draft exists,
 * and the edition of Nome e categoria, Data e horário and Capacidade). Dates are compared as
 * instants, so the same time typed again is no change; an emptied end is cleared.
 */
export function draftChanges(event: EventDetail, form: Partial<DraftForm>): UpdateEventInput {
  const changes: UpdateEventInput = {};
  if (form.name !== undefined && form.name.trim() !== event.name) {
    changes.name = form.name.trim();
  }
  if (form.category !== undefined && form.category !== null && form.category !== event.category) {
    changes.category = form.category;
  }
  if (
    form.startDate !== undefined &&
    form.startTime !== undefined &&
    form.endDate !== undefined &&
    form.endTime !== undefined
  ) {
    const schedule = scheduleToIso({
      startDate: form.startDate,
      startTime: form.startTime,
      endDate: form.endDate,
      endTime: form.endTime,
    });
    if (schedule !== null) {
      if (Date.parse(schedule.startsAt) !== Date.parse(event.startsAt)) {
        changes.startsAt = schedule.startsAt;
      }
      const sameEnd =
        schedule.endsAt === null
          ? event.endsAt === null
          : event.endsAt !== null && Date.parse(schedule.endsAt) === Date.parse(event.endsAt);
      if (!sameEnd) {
        changes.endsAt = schedule.endsAt;
      }
    }
  }
  if (form.capacity !== undefined && Number(form.capacity) !== event.capacity) {
    changes.capacity = Number(form.capacity);
  }
  return changes;
}

/** The minimum capacity of an event: the seats of its types once it is published (SPEC-004 §5). */
export function minimumCapacity(event: EventDetail): number {
  return event.status === "published" ? seatsInTypes(event.ticketTypes) : 0;
}

/** Detalhes · 1 Local: the place, the city of the IBGE base and the address (street and number). */
export interface LocationForm {
  venueName: string;
  city: City | null;
  address: string;
}

export function locationFromEvent(event: EventDetail): LocationForm {
  return { venueName: event.venueName ?? "", city: event.city, address: event.address ?? "" };
}

const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

/** Only what changed; the city is replaced, never cleared (SPEC-015 §6). */
export function locationChanges(event: EventDetail, form: LocationForm): UpdateEventInput {
  const changes: UpdateEventInput = {};
  const venueName = textOrNull(form.venueName);
  if (venueName !== event.venueName) {
    changes.venueName = venueName;
  }
  if (form.city !== null && form.city.code !== event.city?.code) {
    changes.cityCode = form.city.code;
  }
  const address = textOrNull(form.address);
  if (address !== event.address) {
    changes.address = address;
  }
  return changes;
}

/** Detalhes · 4 Descrição e reembolso. */
export interface TextsForm {
  description: string;
  refundPolicy: string;
}

export function textsFromEvent(event: EventDetail): TextsForm {
  return { description: event.description ?? "", refundPolicy: event.refundPolicy ?? "" };
}

export function textsChanges(event: EventDetail, form: TextsForm): UpdateEventInput {
  const changes: UpdateEventInput = {};
  const description = textOrNull(form.description);
  if (description !== event.description) {
    changes.description = description;
  }
  const refundPolicy = textOrNull(form.refundPolicy);
  if (refundPolicy !== event.refundPolicy) {
    changes.refundPolicy = refundPolicy;
  }
  return changes;
}

/** "Campinas, SP": a city as the search and the summary show it. */
export function cityLabel(city: City): string {
  return `${city.name}, ${city.uf}`;
}
