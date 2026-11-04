import type { ProducerProfile } from "../api/producer";
import type { EventDetail } from "../api/producer-events";
import type { EventSection } from "./event-sections";
import { seatsInTypes } from "./ticket-types";

// What the publication of an event needs (SPEC-015 §6, E5, E6; SPEC-004 §4): the verification
// approved, the cover, the category and the city, a ticket type, a date in the future and the types
// within the capacity. Each item says what it is, what is missing and where it is solved.

export type RequirementKey =
  "verification" | "cover" | "categoryCity" | "ticketType" | "futureDate" | "capacity";

/** Done (check), waiting on someone else (clock) or missing, with what to do (alert). */
export type RequirementState = "done" | "waiting" | "missing";

export interface RequirementAction {
  label: string;
  /** The Recebimento, for the verification; a section of the event (`?editar=`), for the rest. */
  target: { kind: "receiving" } | { kind: "section"; section: EventSection };
}

export interface Requirement {
  key: RequirementKey;
  state: RequirementState;
  title: string;
  /** The line under the title, when the item has one. */
  detail: string | null;
  action: RequirementAction | null;
  /** How the disabled button's reason names it: "a capa do evento" (SPEC-015 §6). */
  reason: string;
}

export const receivingHref = "/producer/receiving";

const toReceiving = (label: string): RequirementAction => ({
  label,
  target: { kind: "receiving" },
});

/**
 * The verification's line, by the producer (SPEC-015 E6), in the order of the table: ready, the
 * receiving account failed, BlindPay's request for information, refused, in analysis, approved and
 * still releasing, and nothing sent.
 */
export function verificationRequirement(producer: ProducerProfile): Requirement {
  const line = (
    state: RequirementState,
    title: string,
    detail: string | null,
    action: RequirementAction | null,
    reason = "a verificação ser aprovada",
  ): Requirement => ({ key: "verification", state, title, detail, action, reason });

  const { status } = producer.compliance;
  if (producer.onboardingStatus === "ready") {
    return line("done", "Verificação aprovada", null, null);
  }
  if (producer.stellar.status === "failed") {
    return line(
      "missing",
      "Conta de recebimento com erro",
      "Prepare a conta de novo no Recebimento.",
      toReceiving("Resolver"),
      "a conta de recebimento ficar pronta",
    );
  }
  if (status === "compliance_request") {
    return line(
      "missing",
      "Pedido de informações da BlindPay",
      "Responda para a verificação seguir.",
      toReceiving("Responder"),
    );
  }
  if (status === "rejected") {
    return line(
      "missing",
      "Verificação recusada",
      "Corrija os dados e envie de novo.",
      toReceiving("Corrigir"),
    );
  }
  if (status === "verifying") {
    return line(
      "waiting",
      "Verificação em análise",
      "Publicar fica liberado quando a BlindPay aprovar.",
      null,
    );
  }
  if (status === "approved" || status === "approved_rfi") {
    return line(
      "waiting",
      "Liberando o recebimento",
      "Publicar fica liberado em instantes.",
      null,
      "o recebimento ser liberado",
    );
  }
  return line(
    "missing",
    "Verificação pendente",
    "Termine a configuração do recebimento.",
    toReceiving("Configurar"),
  );
}

const editAction = (section: EventSection, label = "Editar"): RequirementAction => ({
  label,
  target: { kind: "section", section },
});

/** The requirements in the order of the Publicação card (591:12579, 595:13914). */
export function publishRequirements(
  event: EventDetail,
  producer: ProducerProfile,
  now: Date = new Date(),
): Requirement[] {
  const item = (
    key: RequirementKey,
    done: boolean,
    title: string,
    reason: string,
    missing: { detail?: string; action: RequirementAction },
  ): Requirement => ({
    key,
    state: done ? "done" : "missing",
    title,
    detail: done ? null : (missing.detail ?? null),
    action: done ? null : missing.action,
    reason,
  });

  const categoryMissing = event.category === null;
  const cityMissing = event.city === null;
  const seats = seatsInTypes(event.ticketTypes);
  const capacity: Requirement = {
    key: "capacity",
    state: seats <= event.capacity ? "done" : "missing",
    title: "Tipos dentro da capacidade",
    detail: `${seats} de ${event.capacity} lugares`,
    action: seats <= event.capacity ? null : editAction("ingressos"),
    reason: "os tipos caberem na capacidade",
  };
  return [
    verificationRequirement(producer),
    item("cover", event.coverUrl !== null, "Capa do evento", "a capa do evento", {
      detail: "Falta enviar a capa.",
      action: editAction("capa", "Enviar capa"),
    }),
    item(
      "categoryCity",
      !categoryMissing && !cityMissing,
      "Categoria e cidade",
      categoryMissing && cityMissing
        ? "a categoria e a cidade"
        : categoryMissing
          ? "a categoria"
          : "a cidade",
      { action: editAction(categoryMissing ? "nome" : "local") },
    ),
    item(
      "ticketType",
      event.ticketTypes.length > 0,
      "Pelo menos um tipo de ingresso",
      "um tipo de ingresso",
      { action: editAction("ingressos") },
    ),
    item(
      "futureDate",
      Date.parse(event.startsAt) > now.getTime(),
      "Data no futuro",
      "uma data no futuro",
      { action: editAction("data") },
    ),
    capacity,
  ];
}

/** What still keeps the event from being published: the waiting and the missing items. */
export function pendingRequirements(requirements: readonly Requirement[]): Requirement[] {
  return requirements.filter((requirement) => requirement.state !== "done");
}

/** "a, b e c". */
function joinItems(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/**
 * The disabled button's reason (SPEC-015 §6): "Falta a verificação ser aprovada e a capa do
 * evento."; null when everything is done.
 */
export function publishBlockReason(requirements: readonly Requirement[]): string | null {
  const pending = pendingRequirements(requirements);
  return pending.length === 0
    ? null
    : `Falta ${joinItems(pending.map((requirement) => requirement.reason))}.`;
}

/** "Pronto para publicar", "Falta 1 item para publicar" or "Faltam N itens para publicar". */
export function publicationTitle(requirements: readonly Requirement[]): string {
  const count = pendingRequirements(requirements).length;
  if (count === 0) {
    return "Pronto para publicar";
  }
  return count === 1 ? "Falta 1 item para publicar" : `Faltam ${count} itens para publicar`;
}

const lowerFirst = (text: string): string =>
  text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1);

/**
 * The phone's summary of what is missing, under the title (595:13689): "Verificação em análise e
 * capa do evento."; "Todos os requisitos estão cumpridos." when nothing is.
 */
export function pendingSummary(requirements: readonly Requirement[]): string {
  const pending = pendingRequirements(requirements);
  if (pending.length === 0) {
    return "Todos os requisitos estão cumpridos.";
  }
  const names = pending.map((requirement, index) =>
    index === 0 ? requirement.title : lowerFirst(requirement.title),
  );
  return `${joinItems(names)}.`;
}
