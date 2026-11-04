"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { EventCategory } from "../../../_lib/api/producer";
import {
  detailsHref,
  DRAFT_PASSOS,
  eventsHref,
  newEventStepHref,
  resolvePasso,
} from "../../../_lib/producer/event-flow";
import {
  capacityProblem,
  type DraftField,
  draftPassoProblems,
  draftPassosDone,
  nameProblems,
} from "../../../_lib/producer/event-form";
import type { EventFormField } from "../../../_lib/producer/event-errors";
import { type ScheduleField, scheduleProblems } from "../../../_lib/producer/event-schedule";
import { parsePasso } from "../../../_lib/producer/receiving-flow";
import { CapacityField, NameCategoryFields, ScheduleFieldsView } from "./EventFields";
import { useEventFlow } from "./EventFlowProvider";
import { CardAction, ConnectionNotice, EventFormCard, EventStepFrame } from "./EventFrame";
import { useFieldErrors } from "./useFieldErrors";

/** The passo of each field of the draft, for an error the API answers on "Criar rascunho". */
const passoOfField: Partial<Record<EventFormField, number>> = {
  name: 1,
  category: 1,
  startDate: 2,
  endDate: 2,
  capacity: 3,
};

const scheduleOrder: readonly ScheduleField[] = ["startDate", "startTime", "endDate", "endTime"];

/**
 * Figma: Evento · Novo, the draft in three passos (SPEC-015 §6, E4) at
 * `/producer/events/new?passo=N`: name and category, date and time, capacity. Each "Continuar" is a
 * new history entry, so the back of the browser and of the phone goes back a passo with what was
 * typed. "Criar rascunho" creates the draft and opens the details; back here from them, the last
 * passo says "Continuar" and saves the changes instead of creating another draft.
 */
export function CreateEventScreen() {
  const flow = useEventFlow();
  const router = useRouter();
  const params = useSearchParams();
  const asked = parsePasso(params.get("passo"));
  const done = Math.min(draftPassosDone(flow.draft), flow.draftConfirmed);
  const route = resolvePasso(asked, done, DRAFT_PASSOS);
  const redirect = route.kind === "redirect" ? newEventStepHref(route.passo) : null;
  const { errors, settle, leave, showAll, set } = useFieldErrors<DraftField>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    category: useRef<HTMLInputElement>(null),
    startDate: useRef<HTMLInputElement>(null),
    startTime: useRef<HTMLInputElement>(null),
    endDate: useRef<HTMLInputElement>(null),
    endTime: useRef<HTMLInputElement>(null),
    capacity: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  if (route.kind === "redirect") {
    return null;
  }

  const passo = route.passo;
  const href = newEventStepHref(passo);
  const created = flow.createdId !== null;
  const back = (): void => flow.back(href, passo > 1 ? newEventStepHref(passo - 1) : eventsHref);

  const change = (fields: Parameters<typeof flow.setDraft>[0]): void => {
    const next = { ...flow.draft, ...fields };
    flow.setDraft(fields);
    settle(draftPassoProblems(next, passo));
  };

  const focusFirst = (problems: Partial<Record<DraftField, string>>): void => {
    const order: readonly DraftField[] =
      passo === 1 ? ["name", "category"] : passo === 2 ? scheduleOrder : ["capacity"];
    const first = order.find((field) => problems[field] !== undefined);
    if (first !== undefined) {
      refs[first].current?.focus();
    }
  };

  const submit = async (): Promise<void> => {
    const problems = draftPassoProblems(flow.draft, passo);
    showAll(problems);
    if (Object.keys(problems).length > 0) {
      focusFirst(problems);
      return;
    }
    flow.confirmDraft(passo);
    if (passo < DRAFT_PASSOS) {
      flow.go(newEventStepHref(passo + 1));
      return;
    }
    // Every passo is checked again: the start may have passed while the producer typed.
    const earlier = [1, 2].find(
      (step) => Object.keys(draftPassoProblems(flow.draft, step)).length > 0,
    );
    if (earlier !== undefined) {
      flow.go(newEventStepHref(earlier));
      return;
    }
    setSaving(true);
    setFailed(false);
    const result = await flow.saveDraft();
    setSaving(false);
    if (result.ok) {
      flow.go(detailsHref(result.event.id));
      return;
    }
    const problem = result.problem;
    if (problem.kind !== "field") {
      setFailed(true);
      return;
    }
    const at = passoOfField[problem.field] ?? passo;
    set(problem.field as DraftField, problem.message);
    if (at !== passo) {
      flow.go(newEventStepHref(at));
    }
  };

  const notice = failed ? (
    <ConnectionNotice onRetry={() => void submit()} retrying={saving} />
  ) : null;

  const continueButton = (
    <CardAction loading={saving}>
      {passo === DRAFT_PASSOS && !created ? "Criar rascunho" : "Continuar"}
    </CardAction>
  );

  let card;
  if (passo === 1) {
    card = (
      <EventFormCard
        eyebrow={`Rascunho · 1 de ${DRAFT_PASSOS}`}
        title="Nome e categoria"
        description="Aparecem na vitrine e na página do evento."
        descriptionOnPhone={false}
        onSubmit={() => void submit()}
        action={continueButton}
      >
        <NameCategoryFields
          name={flow.draft.name}
          category={flow.draft.category}
          errors={errors}
          nameRef={refs.name}
          categoryRef={refs.category}
          onName={(name) => change({ name })}
          onNameBlur={() => leave("name", nameProblems(flow.draft), flow.draft.name.trim() !== "")}
          onCategory={(category: EventCategory) => change({ category })}
        />
      </EventFormCard>
    );
  } else if (passo === 2) {
    card = (
      <EventFormCard
        eyebrow={`Rascunho · 2 de ${DRAFT_PASSOS}`}
        title="Data e horário"
        description="Horário de Brasília."
        onSubmit={() => void submit()}
        onBack={back}
        action={continueButton}
      >
        <ScheduleFieldsView
          fields={flow.draft}
          errors={errors}
          refs={refs}
          onChange={(field, value) => change({ [field]: value })}
          onBlur={(field) =>
            leave(field, scheduleProblems(flow.draft), flow.draft[field].trim() !== "")
          }
        />
      </EventFormCard>
    );
  } else {
    card = (
      <EventFormCard
        eyebrow={`Rascunho · 3 de ${DRAFT_PASSOS}`}
        title="Capacidade"
        description="Quantas pessoas o evento comporta."
        onSubmit={() => void submit()}
        onBack={back}
        action={continueButton}
        note="O rascunho fica salvo e só você vê. Ninguém vê o evento até você publicar."
      >
        <CapacityField
          value={flow.draft.capacity}
          error={errors.capacity}
          inputRef={refs.capacity}
          onChange={(capacity) => change({ capacity })}
          onBlur={() => {
            const problem = capacityProblem(flow.draft.capacity);
            leave(
              "capacity",
              problem === null ? {} : { capacity: problem },
              flow.draft.capacity !== "",
            );
          }}
        />
      </EventFormCard>
    );
  }

  return (
    <EventStepFrame
      title="Novo evento"
      stage="draft"
      passoDetail={`${passo} de ${DRAFT_PASSOS}`}
      notice={notice}
      onBack={back}
    >
      {card}
    </EventStepFrame>
  );
}
