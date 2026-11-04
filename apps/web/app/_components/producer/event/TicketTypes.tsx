"use client";

import { ActionBar } from "@access/ui/components/action-bar";
import { Button } from "@access/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@access/ui/components/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@access/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@access/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@access/ui/components/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@access/ui/components/table";
import { Textarea } from "@access/ui/components/textarea";
import { DESKTOP_QUERY, useMediaQuery } from "@access/ui/hooks/use-media-query";
import { ChevronRight, Ellipsis, Pencil, Plus, X } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";

import type { EventDetail, TicketType } from "../../../_lib/api/producer-events";
import { formatPrice } from "../../../_lib/format";
import { maskWholeNumber } from "../../../_lib/producer/masks";
import { formatReais, parseReais } from "../../../_lib/producer/money";
import {
  emptyTicketTypeForm,
  fitsInCapacity,
  seatsLine,
  ticketCount,
  type TicketTypeField,
  ticketTypeForm,
  ticketTypeHelp,
  ticketTypeProblems,
} from "../../../_lib/producer/ticket-types";
import { TextField } from "../receiving/TextField";
import { ConnectionNotice } from "./EventFrame";
import { useEventFlow } from "./EventFlowProvider";
import { useFieldErrors } from "./useFieldErrors";

const fieldOrder: readonly TicketTypeField[] = ["name", "description", "price", "quantity"];

/** The fields of a ticket type and its "Adicionar" or "Salvar" (594:13318, 594:12889). */
function useTicketTypeForm(event: EventDetail, type: TicketType | null, onDone: () => void) {
  const flow = useEventFlow();
  const rules = {
    minimumCents: event.ticketMinPriceCents,
    fits: fitsInCapacity(event.capacity, event.ticketTypes, type?.id ?? null),
  };
  const [form, setForm] = useState(type === null ? emptyTicketTypeForm : ticketTypeForm(type));
  const { errors, settle, leave, showAll, set } = useFieldErrors<TicketTypeField>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    price: useRef<HTMLInputElement>(null),
    quantity: useRef<HTMLInputElement>(null),
  };

  const change = (field: TicketTypeField, value: string): void => {
    const next = { ...form, [field]: value };
    setForm(next);
    settle(ticketTypeProblems(next, rules));
  };

  const blur = (field: TicketTypeField): void => {
    let next = form;
    if (field === "price") {
      // The price shows as the field draws it once left: "R$ 60,00".
      const cents = parseReais(form.price);
      next = cents === null ? form : { ...form, price: formatReais(cents) };
      setForm(next);
    }
    leave(field, ticketTypeProblems(next, rules), next[field].trim() !== "");
  };

  const submit = async (): Promise<void> => {
    const problems = ticketTypeProblems(form, rules);
    showAll(problems);
    const first = fieldOrder.find((field) => problems[field] !== undefined);
    if (first !== undefined) {
      refs[first].current?.focus();
      return;
    }
    setSaving(true);
    setFailed(false);
    const result = await flow.saveTicketType(event.id, type?.id ?? null, form);
    setSaving(false);
    if (result.ok) {
      onDone();
    } else if (result.problem.kind === "field") {
      set(result.problem.field, result.problem.message);
      refs[result.problem.field].current?.focus();
    } else {
      setFailed(true);
    }
  };

  const fields = (
    <div className="flex flex-col gap-4">
      {failed ? <ConnectionNotice onRetry={() => void submit()} retrying={saving} /> : null}
      <TextField
        ref={refs.name}
        id="ticket-name"
        label="Nome"
        autoComplete="off"
        maxLength={80}
        value={form.name}
        error={errors.name ?? null}
        onChange={(input) => change("name", input.target.value)}
        onBlur={() => blur("name")}
      />
      <Field>
        <FieldLabel htmlFor="ticket-description">Descrição (opcional)</FieldLabel>
        <Textarea
          ref={refs.description}
          id="ticket-description"
          maxLength={500}
          value={form.description}
          onChange={(input) => change("description", input.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          ref={refs.price}
          id="ticket-price"
          label="Preço"
          inputMode="decimal"
          autoComplete="off"
          placeholder="R$ 0,00"
          value={form.price}
          error={errors.price ?? null}
          help={ticketTypeHelp.price(rules.minimumCents)}
          onChange={(input) => change("price", input.target.value)}
          onBlur={() => blur("price")}
        />
        <TextField
          ref={refs.quantity}
          id="ticket-quantity"
          label="Quantidade"
          inputMode="numeric"
          autoComplete="off"
          value={form.quantity}
          error={errors.quantity ?? null}
          help={ticketTypeHelp.quantity(rules.fits)}
          onChange={(input) => change("quantity", maskWholeNumber(input.target.value))}
          onBlur={() => blur("quantity")}
        />
      </div>
      <p className="type-body-s text-text-tertiary">
        A taxa de serviço é paga por quem compra, por cima do preço.
      </p>
    </div>
  );

  return { fields, submit, saving };
}

/**
 * The window's form sends only itself: it opens in a portal, and React carries its submit to the
 * passo's form around it, which would go on to the next passo.
 */
const submitOwnForm =
  (submit: () => Promise<void>) =>
  (input: FormEvent<HTMLFormElement>): void => {
    input.preventDefault();
    input.stopPropagation();
    void submit();
  };

const editorTexts = (type: TicketType | null) => ({
  title: type === null ? "Novo tipo de ingresso" : "Editar tipo de ingresso",
  action: type === null ? "Adicionar" : "Salvar",
  description: "Aparece na escolha do ingresso, na página do evento.",
});

interface EditorProps {
  event: EventDetail;
  type: TicketType | null;
  onClose: () => void;
}

/** Desktop: the window over the scrim (594:13318), with "Cancelar" and the action at its end. */
function TicketTypeDialog({ event, type, onClose }: EditorProps) {
  const { fields, submit, saving } = useTicketTypeForm(event, type, onClose);
  const texts = editorTexts(type);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <form noValidate className="flex flex-col gap-6" onSubmit={submitOwnForm(submit)}>
          <div className="flex items-start justify-between gap-6">
            <DialogHeader className="gap-1">
              <DialogTitle>{texts.title}</DialogTitle>
              <DialogDescription className="type-body-s">{texts.description}</DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-s" aria-label="Fechar">
                <X />
              </Button>
            </DialogClose>
          </div>
          {fields}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="m" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="inverse" size="m" loading={saving}>
              {texts.action}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Phone: the sheet (Folha · Tipo de ingresso, 594:12889), the action in its Barra de ações. */
function TicketTypeSheet({ event, type, onClose }: EditorProps) {
  const { fields, submit, saving } = useTicketTypeForm(event, type, onClose);
  const texts = editorTexts(type);
  return (
    <Drawer open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DrawerContent className="border-0 bg-bg-surface shadow-none backdrop-blur-none">
        <DrawerHeader className="pr-2 pb-2">
          <DrawerTitle className="min-w-0 flex-1 type-heading-h4">{texts.title}</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-m" aria-label="Fechar">
              <X />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <form noValidate className="flex min-h-0 flex-col" onSubmit={submitOwnForm(submit)}>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2">
            <DrawerDescription className="type-body-s">{texts.description}</DrawerDescription>
            {fields}
          </div>
          <div className="px-4 pt-3 pb-2">
            <ActionBar>
              <Button type="submit" variant="inverse" size="m" loading={saving}>
                {texts.action}
              </Button>
            </ActionBar>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/** "⋯" of a type on the desktop: Editar (deleting a type is out of the interface, P6). */
function TypeActions({ type, onEdit }: { type: TicketType; onEdit: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-s" aria-label={`Ações de ${type.name}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-menu">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          Editar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop: the table of the types (590:12568): name and description, price, quantity, "⋯". */
function TypesTable({
  types,
  onEdit,
}: {
  types: readonly TicketType[];
  onEdit: (type: TicketType) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-border-subtle md:block">
      <Table aria-label="Tipos de ingresso">
        <TableHeader className="rounded-none">
          <TableHead className="flex-1">Tipo</TableHead>
          <TableHead className="w-column-s shrink-0 text-right">Preço</TableHead>
          <TableHead className="w-column-s shrink-0">Quantidade</TableHead>
          <TableHead className="w-control-sm shrink-0">
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableHeader>
        <TableBody>
          {types.map((type) => (
            <TableRow key={type.id}>
              <TableCell className="flex min-w-0 flex-1 flex-col gap-0-5">
                <span className="truncate type-body-m-strong text-text-primary">{type.name}</span>
                {type.description === null ? null : (
                  <span className="truncate type-body-s text-text-tertiary">
                    {type.description}
                  </span>
                )}
              </TableCell>
              <TableCell className="w-column-s shrink-0 text-right type-mono-m text-text-primary">
                {formatPrice(type.priceCents)}
              </TableCell>
              <TableCell className="w-column-s shrink-0 type-body-m text-text-secondary">
                {type.quantity}
              </TableCell>
              <TableCell className="w-control-sm shrink-0">
                <TypeActions type={type} onEdit={() => onEdit(type)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Phone: each type is a line that opens it (590:11998): name, tickets, price and the chevron. */
function TypesList({
  types,
  onEdit,
}: {
  types: readonly TicketType[];
  onEdit: (type: TicketType) => void;
}) {
  return (
    <ul
      aria-label="Tipos de ingresso"
      className="flex flex-col overflow-hidden rounded-lg border border-border-subtle md:hidden"
    >
      {types.map((type) => (
        <li key={type.id} className="border-b border-border-subtle last:border-b-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-bg-subtle focus-visible:inset-ring-2 focus-visible:inset-ring-border-accent"
            onClick={() => onEdit(type)}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0-5">
              <span className="truncate type-body-m-strong text-text-primary">{type.name}</span>
              <span className="type-body-s text-text-tertiary">{ticketCount(type.quantity)}</span>
            </span>
            <span className="type-mono-m whitespace-nowrap text-text-primary">
              {formatPrice(type.priceCents)}
            </span>
            <ChevronRight aria-hidden className="size-icon-sm shrink-0 text-icon-secondary" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Detalhes · 3 Tipos de ingresso (590:12568, 590:11998): the types, "Adicionar tipo de ingresso"
 * and "N de M lugares nos tipos". A type opens in the window of the type, a sheet on the phone;
 * each one is saved there (`POST` or `PATCH .../ticket-types`).
 */
export function TicketTypesField({ event }: { event: EventDetail }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [editing, setEditing] = useState<{ type: TicketType | null } | null>(null);
  const close = (): void => setEditing(null);
  let editor: ReactNode = null;
  if (editing !== null) {
    const props = { event, type: editing.type, onClose: close };
    editor = desktop ? <TicketTypeDialog {...props} /> : <TicketTypeSheet {...props} />;
  }
  return (
    <div className="flex flex-col gap-4">
      {event.ticketTypes.length === 0 ? null : (
        <>
          <TypesTable types={event.ticketTypes} onEdit={(type) => setEditing({ type })} />
          <TypesList types={event.ticketTypes} onEdit={(type) => setEditing({ type })} />
        </>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-3">
        <Button
          variant="secondary"
          size="m"
          className="w-full md:w-auto"
          iconLeft={<Plus />}
          onClick={() => setEditing({ type: null })}
        >
          Adicionar tipo de ingresso
        </Button>
        <p className="text-center type-body-s text-text-tertiary md:flex-1 md:text-right">
          {seatsLine(event.ticketTypes, event.capacity)}
        </p>
      </div>
      {editor}
    </div>
  );
}
