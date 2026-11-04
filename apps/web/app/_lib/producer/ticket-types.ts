import type {
  CreateTicketTypeInput,
  TicketType,
  UpdateTicketTypeInput,
} from "../api/producer-events";
import { formatPrice } from "../format";
import { formatReais, parseReais } from "./money";

// The ticket types of an event (SPEC-015 §6): what fits in the capacity, the form of a type and
// what its Adicionar or Salvar sends. The capacity rule is checked in the draft too, although the
// API only enforces it once the event is published.

/** The seats of all the types together. */
export function seatsInTypes(types: readonly Pick<TicketType, "quantity">[]): number {
  return types.reduce((total, type) => total + type.quantity, 0);
}

/**
 * What fits in one type: the capacity minus the other types, never below zero. `editing` is the
 * type being changed, which does not count against itself.
 */
export function fitsInCapacity(
  capacity: number,
  types: readonly Pick<TicketType, "id" | "quantity">[],
  editing: string | null,
): number {
  const others = types.filter((type) => type.id !== editing);
  return Math.max(0, capacity - seatsInTypes(others));
}

/** "150 de 300 lugares nos tipos" (Detalhes · 3 Tipos de ingresso, 590:12568). */
export function seatsLine(
  types: readonly Pick<TicketType, "quantity">[],
  capacity: number,
): string {
  return `${seatsInTypes(types)} de ${capacity} lugares nos tipos`;
}

/** The ticket type form as typed: the price as the field shows it, the quantity in digits. */
export interface TicketTypeForm {
  name: string;
  description: string;
  price: string;
  quantity: string;
}

export type TicketTypeField = keyof TicketTypeForm;

export const emptyTicketTypeForm: TicketTypeForm = {
  name: "",
  description: "",
  price: "",
  quantity: "",
};

export function ticketTypeForm(type: TicketType): TicketTypeForm {
  return {
    name: type.name,
    description: type.description ?? "",
    price: formatReais(type.priceCents),
    quantity: String(type.quantity),
  };
}

/** The messages of the ticket type (SPEC-015 §6; Figma 594:13040 and 594:13181). */
export const ticketTypeMessages = {
  name: "Escreva o nome do tipo.",
  /** Also the empty quantity, with the text Seus dados uses for a required field. */
  required: "Preencha este campo.",
  minimum: (minimumCents: number) => `O mínimo é ${formatPrice(minimumCents)}.`,
  capacity: (fits: number) => `Passa da capacidade: use até ${fits}.`,
  committed: "Não pode ficar abaixo do que já foi vendido ou reservado.",
} as const;

/** "Mínimo de R$ 60,00." and "Até 150 pela capacidade.", under the price and the quantity. */
export const ticketTypeHelp = {
  price: (minimumCents: number) => `Mínimo de ${formatPrice(minimumCents)}.`,
  quantity: (fits: number) => `Até ${fits} pela capacidade.`,
} as const;

export interface TicketTypeRules {
  /** `ticketMinPriceCents` of the event. */
  minimumCents: number;
  /** What fits in the capacity for this type. */
  fits: number;
}

/** What is wrong with each field, in the order of the screen; empty when it can be sent. */
export function ticketTypeProblems(
  form: TicketTypeForm,
  { minimumCents, fits }: TicketTypeRules,
): Partial<Record<TicketTypeField, string>> {
  const problems: Partial<Record<TicketTypeField, string>> = {};
  if (form.name.trim() === "") {
    problems.name = ticketTypeMessages.name;
  }
  const cents = parseReais(form.price);
  if (cents === null || cents < minimumCents) {
    problems.price = ticketTypeMessages.minimum(minimumCents);
  }
  const quantity = Number(form.quantity);
  if (form.quantity.trim() === "" || !Number.isInteger(quantity) || quantity < 1) {
    problems.quantity = ticketTypeMessages.required;
  } else if (quantity > fits) {
    problems.quantity = ticketTypeMessages.capacity(fits);
  }
  return problems;
}

/** "Adicionar": the new type, once the form has no problem. */
export function createTicketTypeInput(form: TicketTypeForm): CreateTicketTypeInput | null {
  const priceCents = parseReais(form.price);
  const quantity = Number(form.quantity);
  if (form.name.trim() === "" || priceCents === null || !Number.isInteger(quantity)) {
    return null;
  }
  const description = form.description.trim();
  return {
    name: form.name.trim(),
    ...(description === "" ? {} : { description }),
    priceCents,
    quantity,
  };
}

/** "Salvar": only what changed; an emptied description is cleared. */
export function ticketTypeChanges(type: TicketType, form: TicketTypeForm): UpdateTicketTypeInput {
  const changes: UpdateTicketTypeInput = {};
  const name = form.name.trim();
  if (name !== type.name) {
    changes.name = name;
  }
  const description = form.description.trim() === "" ? null : form.description.trim();
  if (description !== type.description) {
    changes.description = description;
  }
  const priceCents = parseReais(form.price);
  if (priceCents !== null && priceCents !== type.priceCents) {
    changes.priceCents = priceCents;
  }
  const quantity = Number(form.quantity);
  if (Number.isInteger(quantity) && quantity !== type.quantity) {
    changes.quantity = quantity;
  }
  return changes;
}

/** "120 ingressos", under a type in the phone's list (590:11998). */
export function ticketCount(quantity: number): string {
  return quantity === 1 ? "1 ingresso" : `${quantity} ingressos`;
}
