"use client";

import { type ReactNode, useRef, useState } from "react";

import type { EventCategory } from "../../../_lib/api/producer";
import type { EventDetail, UpdateEventInput } from "../../../_lib/api/producer-events";
import type { EventFormField } from "../../../_lib/producer/event-errors";
import {
  capacityProblem,
  draftChanges,
  draftFromEvent,
  locationChanges,
  locationFromEvent,
  minimumCapacity,
  nameProblems,
  textsChanges,
  textsFromEvent,
} from "../../../_lib/producer/event-form";
import { type EventSection, sectionTitles } from "../../../_lib/producer/event-sections";
import {
  type ScheduleField,
  type ScheduleFields,
  scheduleProblems,
} from "../../../_lib/producer/event-schedule";
import { CoverUpload } from "./CoverUpload";
import {
  CapacityField,
  LocationFields,
  NameCategoryFields,
  ScheduleFieldsView,
  TextsFields,
} from "./EventFields";
import { useEventFlow } from "./EventFlowProvider";
import { CardAction, ConnectionNotice, EventFormCard } from "./EventFrame";
import { TicketTypesField } from "./TicketTypes";
import { useFieldErrors } from "./useFieldErrors";

/** The line under each section's title, the one of its passo (SPEC-015 §6). */
const sectionDescriptions: Partial<Record<EventSection, string>> = {
  nome: "Aparecem na vitrine e na página do evento.",
  data: "Horário de Brasília.",
  capacidade: "Quantas pessoas o evento comporta.",
  capa: "Aparece na vitrine, na página do evento e nos ingressos.",
  ingressos: "Nome, preço e quantidade de cada tipo.",
  descricao: "Aparecem na página do evento, antes da compra.",
};

interface EditProps {
  event: EventDetail;
  /** Back to the summary: after saving, on "Cancelar", on the phone's back. */
  onDone: () => void;
}

/** The edition's card: "Editar", the section's title and line, "Cancelar" (desktop) and "Salvar". */
function EditCard({
  section,
  saving,
  failed,
  onSave,
  onCancel,
  children,
}: {
  section: EventSection;
  saving: boolean;
  failed: (() => void) | null;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const description = sectionDescriptions[section];
  return (
    <EventFormCard
      eyebrow="Editar"
      title={sectionTitles[section]}
      {...(description === undefined ? {} : { description })}
      descriptionOnPhone={section !== "nome"}
      notice={failed === null ? undefined : <ConnectionNotice onRetry={failed} retrying={saving} />}
      onSubmit={onSave}
      onBack={onCancel}
      backLabel="Cancelar"
      action={<CardAction loading={saving}>Salvar</CardAction>}
    >
      {children}
    </EventFormCard>
  );
}

/** Saving an edition: the changes, the field the API points at, or the toast. */
function useSave(
  event: EventDetail,
  onDone: () => void,
  onField: (field: EventFormField, message: string) => void,
) {
  const flow = useEventFlow();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<(() => void) | null>(null);
  const save = async (changes: UpdateEventInput): Promise<void> => {
    setSaving(true);
    setFailed(null);
    const result = await flow.saveEvent(event.id, changes);
    setSaving(false);
    if (result.ok) {
      onDone();
    } else if (result.problem.kind === "field") {
      onField(result.problem.field, result.problem.message);
    } else {
      setFailed(() => () => void save(changes));
    }
  };
  return { save, saving, failed };
}

/** Nome e categoria. */
function EditName({ event, onDone }: EditProps) {
  const [form, setForm] = useState(() => {
    const draft = draftFromEvent(event);
    return { name: draft.name, category: draft.category };
  });
  const { errors, settle, leave, showAll, set } = useFieldErrors<"name" | "category">();
  const { save, saving, failed } = useSave(event, onDone, (field, message) => {
    if (field === "name" || field === "category") {
      set(field, message);
    }
  });
  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const change = (fields: Partial<typeof form>): void => {
    const next = { ...form, ...fields };
    setForm(next);
    settle(nameProblems(next));
  };
  const submit = (): void => {
    const problems = nameProblems(form);
    showAll(problems);
    if (problems.name !== undefined) {
      nameRef.current?.focus();
    } else if (problems.category !== undefined) {
      categoryRef.current?.focus();
    } else {
      void save(draftChanges(event, form));
    }
  };
  return (
    <EditCard section="nome" saving={saving} failed={failed} onSave={submit} onCancel={onDone}>
      <NameCategoryFields
        name={form.name}
        category={form.category}
        errors={errors}
        nameRef={nameRef}
        categoryRef={categoryRef}
        onName={(name) => change({ name })}
        onNameBlur={() => leave("name", nameProblems(form), form.name.trim() !== "")}
        onCategory={(category: EventCategory) => change({ category })}
      />
    </EditCard>
  );
}

/** Data e horário: in a published event, the start stays in the future (SPEC-004 §5). */
function EditSchedule({ event, onDone }: EditProps) {
  const [fields, setFields] = useState<ScheduleFields>(() => {
    const draft = draftFromEvent(event);
    return {
      startDate: draft.startDate,
      startTime: draft.startTime,
      endDate: draft.endDate,
      endTime: draft.endTime,
    };
  });
  const { errors, settle, leave, showAll, set } = useFieldErrors<ScheduleField>();
  const refs = {
    startDate: useRef<HTMLInputElement>(null),
    startTime: useRef<HTMLInputElement>(null),
    endDate: useRef<HTMLInputElement>(null),
    endTime: useRef<HTMLInputElement>(null),
  };
  const { save, saving, failed } = useSave(event, onDone, (field, message) => {
    if (field === "startDate" || field === "endDate") {
      set(field, message);
    }
  });
  const submit = (): void => {
    const problems = scheduleProblems(fields);
    showAll(problems);
    const first = (["startDate", "startTime", "endDate", "endTime"] as const).find(
      (field) => problems[field] !== undefined,
    );
    if (first !== undefined) {
      refs[first].current?.focus();
    } else {
      void save(draftChanges(event, fields));
    }
  };
  return (
    <EditCard section="data" saving={saving} failed={failed} onSave={submit} onCancel={onDone}>
      <ScheduleFieldsView
        fields={fields}
        errors={errors}
        refs={refs}
        onChange={(field, value) => {
          const next = { ...fields, [field]: value };
          setFields(next);
          settle(scheduleProblems(next));
        }}
        onBlur={(field) => leave(field, scheduleProblems(fields), fields[field].trim() !== "")}
      />
    </EditCard>
  );
}

/** Capacidade: in a published event, not below the seats of the types (SPEC-004 §5). */
function EditCapacity({ event, onDone }: EditProps) {
  const [capacity, setCapacity] = useState(String(event.capacity));
  const minimum = minimumCapacity(event);
  const { errors, settle, leave, showAll, set } = useFieldErrors<"capacity">();
  const inputRef = useRef<HTMLInputElement>(null);
  const { save, saving, failed } = useSave(event, onDone, (field, message) => {
    if (field === "capacity") {
      set("capacity", message);
    }
  });
  const problems = (value: string) => {
    const problem = capacityProblem(value, minimum);
    return problem === null ? {} : { capacity: problem };
  };
  const submit = (): void => {
    const found = problems(capacity);
    showAll(found);
    if (found.capacity !== undefined) {
      inputRef.current?.focus();
    } else {
      void save(draftChanges(event, { capacity }));
    }
  };
  return (
    <EditCard
      section="capacidade"
      saving={saving}
      failed={failed}
      onSave={submit}
      onCancel={onDone}
    >
      <CapacityField
        value={capacity}
        error={errors.capacity}
        inputRef={inputRef}
        onChange={(value) => {
          setCapacity(value);
          settle(problems(value));
        }}
        onBlur={() => leave("capacity", problems(capacity), capacity !== "")}
      />
    </EditCard>
  );
}

/** Local. */
function EditLocation({ event, onDone }: EditProps) {
  const [form, setForm] = useState(() => locationFromEvent(event));
  const { save, saving, failed } = useSave(event, onDone, () => undefined);
  return (
    <EditCard
      section="local"
      saving={saving}
      failed={failed}
      onSave={() => void save(locationChanges(event, form))}
      onCancel={onDone}
    >
      <LocationFields form={form} onChange={setForm} />
    </EditCard>
  );
}

/** Descrição e reembolso. */
function EditTexts({ event, onDone }: EditProps) {
  const [form, setForm] = useState(() => textsFromEvent(event));
  const { save, saving, failed } = useSave(event, onDone, () => undefined);
  return (
    <EditCard
      section="descricao"
      saving={saving}
      failed={failed}
      onSave={() => void save(textsChanges(event, form))}
      onCancel={onDone}
    >
      <TextsFields form={form} onChange={setForm} />
    </EditCard>
  );
}

/**
 * Capa and Tipos de ingresso save as they go (the upload, the window of the type), so their
 * edition ends with "Concluir" (SPEC-015 §6).
 */
function EditInPlace({ event, section, onDone }: EditProps & { section: "capa" | "ingressos" }) {
  const flow = useEventFlow();
  const cover = flow.cover(event.id);
  const description = sectionDescriptions[section];
  return (
    <EventFormCard
      eyebrow="Editar"
      title={sectionTitles[section]}
      {...(description === undefined ? {} : { description })}
      notice={
        section === "capa" && cover.status === "failed" ? (
          <ConnectionNotice onRetry={() => flow.retryCover(event.id)} />
        ) : undefined
      }
      onSubmit={onDone}
      action={
        <CardAction disabled={section === "capa" && cover.status === "uploading"}>
          Concluir
        </CardAction>
      }
    >
      {section === "capa" ? <CoverUpload event={event} /> : null}
      {section === "ingressos" ? <TicketTypesField event={event} /> : null}
    </EventFormCard>
  );
}

/**
 * Evento · Editar uma seção (593:12840, 593:12739): the fields of the section's passo under
 * "Editar", at `?editar=<seção>`. "Salvar" saves (`PATCH`) and goes back to the summary; "Cancelar"
 * and the back discard. The published event keeps the rules of SPEC-004 §5.
 */
export function EditSection({ event, section, onDone }: EditProps & { section: EventSection }) {
  switch (section) {
    case "nome":
      return <EditName event={event} onDone={onDone} />;
    case "data":
      return <EditSchedule event={event} onDone={onDone} />;
    case "capacidade":
      return <EditCapacity event={event} onDone={onDone} />;
    case "local":
      return <EditLocation event={event} onDone={onDone} />;
    case "descricao":
      return <EditTexts event={event} onDone={onDone} />;
    case "capa":
    case "ingressos":
      return <EditInPlace event={event} section={section} onDone={onDone} />;
  }
}
