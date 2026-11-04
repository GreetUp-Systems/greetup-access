"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import type { EventDetail } from "../../../_lib/api/producer-events";
import {
  DETAILS_PASSOS,
  detailsHref,
  eventHref,
  eventsHref,
  newEventStepHref,
  resolvePasso,
} from "../../../_lib/producer/event-flow";
import {
  locationChanges,
  locationFromEvent,
  textsChanges,
  textsFromEvent,
} from "../../../_lib/producer/event-form";
import { eventStatus } from "../../../_lib/producer/events";
import { parsePasso } from "../../../_lib/producer/receiving-flow";
import { ProducerLoading } from "../ProducerStates";
import { LoadFailed } from "../../LoadFailed";
import { CoverUpload } from "./CoverUpload";
import { LocationFields, TextsFields } from "./EventFields";
import { useEvent, useEventFlow } from "./EventFlowProvider";
import {
  CardAction,
  ConnectionNotice,
  DraftCreatedNotice,
  EventFormCard,
  EventStepFrame,
} from "./EventFrame";
import { TicketTypesField } from "./TicketTypes";

const passoTitles = ["Local", "Capa", "Tipos de ingresso", "Descrição e reembolso"] as const;

const passoDescriptions: Partial<Record<number, string>> = {
  2: "Aparece na vitrine, na página do evento e nos ingressos.",
  3: "Nome, preço e quantidade de cada tipo.",
  4: "Aparecem na página do evento, antes da compra.",
};

/**
 * Figma: Evento · Detalhes, the rest of the event in four passos (SPEC-015 §6, E4) at
 * `/producer/events/[id]/details?passo=N`: location, cover, ticket types, description and refund.
 * Each passo saves on "Continuar" (`PATCH`, only what changed) and may stay empty; the cover and
 * the types are saved as they are sent. The last "Continuar" opens the event page.
 */
export function EventDetailsScreen() {
  const { id } = useParams<{ id: string }>();
  const entry = useEvent(id);
  const flow = useEventFlow();
  const router = useRouter();

  useEffect(() => {
    if (entry.status === "gone") {
      router.replace(eventsHref);
    }
  }, [entry.status, router]);

  if (entry.status === "failed") {
    return <LoadFailed onRetry={() => flow.loadEvent(id, true)} />;
  }
  if (entry.status !== "ready") {
    return <ProducerLoading />;
  }
  return <Details event={entry.event} />;
}

function Details({ event }: { event: EventDetail }) {
  const flow = useEventFlow();
  const router = useRouter();
  const params = useSearchParams();
  const asked = parsePasso(params.get("passo"));
  const route = resolvePasso(asked, flow.detailsConfirmed(event.id), DETAILS_PASSOS);
  const redirect = route.kind === "redirect" ? detailsHref(event.id, route.passo) : null;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<null | (() => void)>(null);

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  if (route.kind === "redirect") {
    return null;
  }

  const passo = route.passo;
  const href = detailsHref(event.id, passo);
  // Back from the first passo is the creation in this flow; opened straight here, the event page.
  const back = (): void => {
    flow.dismissCreated();
    flow.back(
      href,
      passo > 1
        ? detailsHref(event.id, passo - 1)
        : flow.createdId === event.id
          ? newEventStepHref(3)
          : eventHref(event.id),
    );
  };
  const next = (): void => {
    flow.confirmDetails(event.id, passo);
    flow.dismissCreated();
    flow.go(passo < DETAILS_PASSOS ? detailsHref(event.id, passo + 1) : eventHref(event.id));
  };

  const location = flow.location(event.id) ?? locationFromEvent(event);
  const texts = flow.texts(event.id) ?? textsFromEvent(event);

  const save = async (changes: Parameters<typeof flow.saveEvent>[1]): Promise<void> => {
    setSaving(true);
    setFailed(null);
    const result = await flow.saveEvent(event.id, changes);
    setSaving(false);
    if (result.ok) {
      next();
    } else if (result.problem.kind === "gone") {
      router.replace(eventsHref);
    } else {
      // The details' fields have no rule the API checks apart from the city, which comes from the
      // base: whatever else it answers is the toast's.
      setFailed(() => () => void save(changes));
    }
  };

  const submit = (): void => {
    if (passo === 1) {
      void save(locationChanges(event, location));
    } else if (passo === 4) {
      void save(textsChanges(event, texts));
    } else {
      next();
    }
  };

  const cover = flow.cover(event.id);
  const created = flow.justCreated === event.id && passo === 1;
  let notice: ReactNode = null;
  if (failed !== null) {
    notice = <ConnectionNotice onRetry={failed} retrying={saving} />;
  } else if (passo === 2 && cover.status === "failed") {
    notice = <ConnectionNotice onRetry={() => flow.retryCover(event.id)} />;
  } else if (created) {
    // On the phone above the progress; on the desktop at the top of the card (588:11718).
    notice = <DraftCreatedNotice className="md:hidden" />;
  }

  let fields: ReactNode;
  if (passo === 1) {
    fields = (
      <LocationFields form={location} onChange={(form) => flow.setLocation(event.id, form)} />
    );
  } else if (passo === 2) {
    fields = <CoverUpload event={event} />;
  } else if (passo === 3) {
    fields = <TicketTypesField event={event} />;
  } else {
    fields = <TextsFields form={texts} onChange={(form) => flow.setTexts(event.id, form)} />;
  }

  return (
    <EventStepFrame
      title={event.name}
      status={eventStatus(event, new Date())}
      stage="details"
      passoDetail={`${passo} de ${DETAILS_PASSOS}`}
      notice={notice}
      onBack={back}
    >
      <EventFormCard
        eyebrow={`Detalhes · ${passo} de ${DETAILS_PASSOS}`}
        title={passoTitles[passo - 1] ?? ""}
        {...(passoDescriptions[passo] === undefined
          ? {}
          : { description: passoDescriptions[passo] })}
        notice={
          created ? (
            <DraftCreatedNotice className="hidden md:flex md:w-fit md:self-start" />
          ) : undefined
        }
        onSubmit={submit}
        onBack={back}
        action={
          <CardAction loading={saving} disabled={cover.status === "uploading"}>
            Continuar
          </CardAction>
        }
      >
        {fields}
      </EventFormCard>
    </EventStepFrame>
  );
}
