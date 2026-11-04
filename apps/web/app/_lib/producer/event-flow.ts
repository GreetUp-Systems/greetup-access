import type { SetupStepState } from "./dashboard";
import type { EventSection } from "./event-sections";

// The event's routes and passos (SPEC-015 §6, E4): the draft in 3 passos at /producer/events/new,
// the details in 4 at /producer/events/[id]/details, and the event page at /producer/events/[id]
// with ?editar=<seção>. Each passo and each edition is a history entry, as in the Recebimento.

export const eventsHref = "/producer/events";
export const newEventHref = "/producer/events/new";

/** The draft's passos: name and category, date and time, capacity. */
export const DRAFT_PASSOS = 3;
/** The details' passos: location, cover, ticket types, description and refund. */
export const DETAILS_PASSOS = 4;

const withPasso = (path: string, passo: number): string =>
  passo > 1 ? `${path}?passo=${passo}` : path;

export function newEventStepHref(passo = 1): string {
  return withPasso(newEventHref, passo);
}

export function eventHref(eventId: string): string {
  return `${eventsHref}/${encodeURIComponent(eventId)}`;
}

export function detailsHref(eventId: string, passo = 1): string {
  return withPasso(`${eventHref(eventId)}/details`, passo);
}

export function editHref(eventId: string, section: EventSection): string {
  return `${eventHref(eventId)}?editar=${section}`;
}

/** The public page of a published event, opened by "Ver página" (SPEC-016). */
export function publicEventPath(slug: string): string {
  return `/e/${encodeURIComponent(slug)}`;
}

export type PassoRoute = { kind: "show"; passo: number } | { kind: "redirect"; passo: number };

/**
 * The passo an address shows, or the first pending one it leads to (SPEC-015 §6): a passo is open
 * once the ones before it were done; `done` counts them in a row.
 */
export function resolvePasso(asked: number, done: number, total: number): PassoRoute {
  const firstPending = Math.min(done + 1, total);
  return asked <= firstPending
    ? { kind: "show", passo: asked }
    : { kind: "redirect", passo: firstPending };
}

/** The two stages filled in passos; the third, Publicação, is the event page. */
export type EventStage = "draft" | "details";

/** "Etapa N de 3" and the stage's name beside it, on the phone (586:10877, 588:11433). */
export const STAGE_COUNT = 3;
export const stagePosition: Record<EventStage, { number: number; name: string }> = {
  draft: { number: 1, name: "Rascunho" },
  details: { number: 2, name: "Detalhes" },
};

export interface EventStageItem {
  key: "draft" | "details" | "publication";
  title: string;
  state: SetupStepState;
  detail: string;
}

/**
 * The Etapas list beside the passo on the desktop (586:11098, 588:11718): the stage on the screen
 * is current with its passo ("1 de 3"); the draft is "Salvo" once the details start.
 */
export function eventStages(stage: EventStage, detail: string): EventStageItem[] {
  const publication: EventStageItem = {
    key: "publication",
    title: "Publicação",
    state: "pending",
    detail: "Revisar e publicar",
  };
  if (stage === "draft") {
    return [
      { key: "draft", title: "Rascunho", state: "current", detail },
      {
        key: "details",
        title: "Detalhes",
        state: "pending",
        detail: "Local, capa, ingressos e reembolso",
      },
      publication,
    ];
  }
  return [
    { key: "draft", title: "Rascunho", state: "done", detail: "Salvo" },
    { key: "details", title: "Detalhes", state: "current", detail },
    publication,
  ];
}
