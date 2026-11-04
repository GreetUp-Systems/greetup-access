"use client";

import { Category, CategoryIcon, CategoryLabel } from "@access/ui/components/category";
import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import { Input } from "@access/ui/components/input";
import { Textarea } from "@access/ui/components/textarea";
import {
  Baby,
  Drama,
  GraduationCap,
  type LucideIcon,
  Mic,
  Music,
  PartyPopper,
  Tent,
  Trophy,
  Utensils,
} from "lucide-react";
import { type ComponentProps, type ReactNode, type Ref, useId } from "react";

import { type EventCategory, eventCategories } from "../../../_lib/api/producer";
import {
  categoryLabels,
  type LocationForm,
  type TextsForm,
} from "../../../_lib/producer/event-form";
import type { ScheduleField, ScheduleFields } from "../../../_lib/producer/event-schedule";
import { maskDate, maskTime, maskWholeNumber } from "../../../_lib/producer/masks";
import { TextField } from "../receiving/TextField";
import { CityField } from "./CityField";

// The fields of each part of the event (SPEC-015 §6), shared by the passos of the creation and of
// the details and by the edition of a section: the values, the errors, and leaving a field.

/** The categories' icons (SPEC-015 §5.3), the shop window's too. */
export const categoryIcons: Record<EventCategory, LucideIcon> = {
  shows: Music,
  parties: PartyPopper,
  theater: Drama,
  standup: Mic,
  sports: Trophy,
  festivals: Tent,
  kids: Baby,
  courses: GraduationCap,
  food: Utensils,
};

type Errors<F extends string> = Partial<Record<F, string>>;

/**
 * Figma: Categoria (314:170) as the options of the form: 3 a row on the phone; on the desktop they
 * wrap at the pitch of the frame (586:11098): 96 options, space/8 apart, inside space/2.
 */
function CategoryPicker({
  value,
  error,
  onChange,
  firstRef,
}: {
  value: EventCategory | null;
  error?: string | undefined;
  onChange: (category: EventCategory) => void;
  firstRef?: Ref<HTMLInputElement> | undefined;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="type-body-m-strong text-text-primary">
        Categoria
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4 md:px-2"
      >
        {eventCategories.map((category, index) => {
          const Icon = categoryIcons[category];
          const selected = value === category;
          return (
            <Category key={category} asChild selected={selected} className="md:w-24">
              <label>
                <input
                  ref={index === 0 ? firstRef : undefined}
                  type="radio"
                  name={`${id}-category`}
                  value={category}
                  checked={selected}
                  className="sr-only"
                  onChange={() => onChange(category)}
                />
                <CategoryIcon>
                  <Icon />
                </CategoryIcon>
                <CategoryLabel>{categoryLabels[category]}</CategoryLabel>
              </label>
            </Category>
          );
        })}
      </div>
      {error === undefined ? null : <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/** Rascunho · 1 Nome e categoria (586:11098, 586:10877). */
export function NameCategoryFields({
  name,
  category,
  errors,
  onName,
  onNameBlur,
  onCategory,
  nameRef,
  categoryRef,
}: {
  name: string;
  category: EventCategory | null;
  errors: Errors<"name" | "category">;
  onName: (value: string) => void;
  onNameBlur: () => void;
  onCategory: (value: EventCategory) => void;
  nameRef?: Ref<HTMLInputElement>;
  categoryRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        ref={nameRef}
        id="event-name"
        label="Nome"
        autoComplete="off"
        maxLength={120}
        value={name}
        error={errors.name ?? null}
        onChange={(event) => onName(event.target.value)}
        onBlur={onNameBlur}
      />
      <CategoryPicker
        value={category}
        error={errors.category}
        onChange={onCategory}
        firstRef={categoryRef}
      />
    </div>
  );
}

/** A field whose visible label is shared by two ("Horário"): the rest of its name is for readers. */
function labelWithContext(label: string, context: string): ReactNode {
  return (
    <>
      {label}
      <span className="sr-only"> {context}</span>
    </>
  );
}

interface ScheduleFieldProps {
  fields: ScheduleFields;
  errors: Errors<ScheduleField>;
  onChange: (field: ScheduleField, value: string) => void;
  onBlur: (field: ScheduleField) => void;
  refs?: Partial<Record<ScheduleField, Ref<HTMLInputElement>>>;
}

/** Rascunho · 2 Data e horário (587:11387, 587:11157): the start, and the optional end, in Brasília. */
export function ScheduleFieldsView({
  fields,
  errors,
  onChange,
  onBlur,
  refs = {},
}: ScheduleFieldProps) {
  const field = (
    key: ScheduleField,
    id: string,
    label: ReactNode,
    kind: "date" | "time",
  ): ReactNode => (
    <DateTimeField
      ref={refs[key]}
      id={id}
      label={label}
      placeholder={kind === "date" ? "DD/MM/AAAA" : "HH:MM"}
      value={fields[key]}
      error={errors[key] ?? null}
      onChange={(event) =>
        onChange(key, (kind === "date" ? maskDate : maskTime)(event.target.value))
      }
      onBlur={() => onBlur(key)}
    />
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      {field("startDate", "event-start-date", "Data de início", "date")}
      {field("startTime", "event-start-time", labelWithContext("Horário", "de início"), "time")}
      {field("endDate", "event-end-date", "Término (opcional)", "date")}
      {field("endTime", "event-end-time", labelWithContext("Horário", "de término"), "time")}
    </div>
  );
}

/** A date or a time (Campo de texto M): the numeric keyboard, with the mask as typed (SPEC-015 §6). */
function DateTimeField({
  id,
  label,
  error,
  ...input
}: Omit<ComponentProps<"input">, "id" | "size"> & {
  id: string;
  label: ReactNode;
  error: string | null;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        size="m"
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? undefined : `${id}-error`}
        {...input}
      />
      {error === null ? null : <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

/** Rascunho · 3 Capacidade (587:11593, 587:11300). */
export function CapacityField({
  value,
  error,
  onChange,
  onBlur,
  inputRef,
}: {
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField
        ref={inputRef}
        id="event-capacity"
        label="Número de pessoas"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        error={error ?? null}
        help="A soma dos tipos de ingresso não passa disso."
        onChange={(event) => onChange(maskWholeNumber(event.target.value))}
        onBlur={onBlur}
      />
    </div>
  );
}

/** Detalhes · 1 Local (588:11718, 588:11433): the place, the city of the IBGE base, the address. */
export function LocationFields({
  form,
  onChange,
}: {
  form: LocationForm;
  onChange: (form: LocationForm) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        id="event-venue"
        label="Local"
        autoComplete="off"
        maxLength={120}
        value={form.venueName}
        onChange={(event) => onChange({ ...form, venueName: event.target.value })}
      />
      <CityField
        id="event-city"
        value={form.city}
        help="Obrigatória para publicar."
        onChange={(city) => onChange({ ...form, city })}
      />
      <TextField
        id="event-address"
        label="Endereço"
        autoComplete="off"
        maxLength={200}
        value={form.address}
        help="Rua e número."
        onChange={(event) => onChange({ ...form, address: event.target.value })}
      />
    </div>
  );
}

/** Detalhes · 4 Descrição e reembolso (590:12782, 590:12104): Área de texto, up to the API's sizes. */
export function TextsFields({
  form,
  onChange,
}: {
  form: TextsForm;
  onChange: (form: TextsForm) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="event-description">Descrição</FieldLabel>
        <Textarea
          id="event-description"
          maxLength={5000}
          aria-describedby="event-description-help"
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
        <FieldDescription id="event-description-help">Até 5.000 caracteres.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="event-refund">Política de reembolso</FieldLabel>
        <Textarea
          id="event-refund"
          maxLength={2000}
          value={form.refundPolicy}
          onChange={(event) => onChange({ ...form, refundPolicy: event.target.value })}
        />
      </Field>
    </div>
  );
}
