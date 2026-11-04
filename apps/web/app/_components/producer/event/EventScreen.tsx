"use client";

import { Button } from "@access/ui/components/button";
import { TopBar } from "@access/ui/components/top-bar";
import { cn } from "@access/ui/lib/utils";
import { ExternalLink } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { EventDetail } from "../../../_lib/api/producer-events";
import {
  editHref,
  eventHref,
  eventsHref,
  publicEventPath,
} from "../../../_lib/producer/event-flow";
import { parseSection } from "../../../_lib/producer/event-sections";
import { eventStatus } from "../../../_lib/producer/events";
import { publishRequirements } from "../../../_lib/producer/publication";
import { LoadFailed } from "../../LoadFailed";
import { useProducer } from "../ProducerContext";
import { ProducerLoading } from "../ProducerStates";
import { EditSection } from "./EditSection";
import { useEvent, useEventFlow } from "./EventFlowProvider";
import { ConnectionNotice, EventPageHeader } from "./EventFrame";
import { EventSummary } from "./EventSummary";
import {
  BottomBar,
  OnSaleHeader,
  PublicationCard,
  PublicationHeader,
  PublishedActions,
  PublishedCards,
  PublishSheet,
} from "./Publication";

/**
 * Figma: the event page (SPEC-015 §6, E5) at `/producer/events/[id]`: the Status, the summary by
 * section with "Editar" (`?editar=<seção>`), and the publication. Desktop: the Publicação card
 * beside the summary; phone: what is missing above it and "Publicar evento" at the bottom, which
 * opens the confirmation in a sheet. Published: the same page, editable, with À venda and Vendas.
 */
export function EventScreen() {
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
  return <EventPage event={entry.event} />;
}

function EventPage({ event }: { event: EventDetail }) {
  const { producer, events, reloadEvents } = useProducer();
  const flow = useEventFlow();
  const params = useSearchParams();
  const editing = event.status === "cancelled" ? null : parseSection(params.get("editar"));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [failed, setFailed] = useState(false);

  // The sales come from the events' list (SPEC-015 §6), read again as the page opens.
  useEffect(() => {
    void reloadEvents();
  }, [reloadEvents]);

  const now = new Date();
  const status = eventStatus(event, now);
  const draft = event.status === "draft";
  const published = event.status === "published";
  const requirements = publishRequirements(event, producer, now);
  const listed = events.find((item) => item.id === event.id);
  const sales = { soldTickets: listed?.soldTickets ?? 0, salesCents: listed?.salesCents ?? 0 };
  const href = editing === null ? eventHref(event.id) : editHref(event.id, editing);

  const publish = async (): Promise<void> => {
    setPublishing(true);
    setFailed(false);
    const result = await flow.publish(event.id);
    setPublishing(false);
    if (result === "published") {
      setSheetOpen(false);
    } else if (result === "failed") {
      setFailed(true);
    }
    // Otherwise the event or the producer was read again, and the requirements say what is missing.
  };

  const backToSummary = (): void => flow.back(href, eventHref(event.id));
  const back = (): void => (editing === null ? flow.back(href, eventsHref) : backToSummary());

  const viewPage = published ? (
    <Button asChild variant="ghost" size="m">
      <a href={publicEventPath(event.slug)} target="_blank" rel="noreferrer">
        Ver página
        <ExternalLink aria-hidden />
      </a>
    </Button>
  ) : undefined;

  let aside = null;
  if (draft) {
    aside = (
      <PublicationCard
        event={event}
        requirements={requirements}
        publishing={publishing}
        failed={failed}
        onPublish={() => void publish()}
      />
    );
  } else if (published) {
    aside = <PublishedCards event={event} sales={sales} />;
  }

  const showBar = editing === null && (draft || published);

  return (
    <>
      <TopBar
        type="navigation"
        title={event.name}
        onBack={back}
        className="-mx-4 -mt-2 md:hidden"
      />
      <div className={cn("flex flex-col gap-4 pt-3 md:gap-6 md:pt-0", showBar && "pb-16 md:pb-0")}>
        <EventPageHeader title={event.name} status={status} actions={viewPage} />
        {failed && editing === null ? (
          <ConnectionNotice
            className="md:hidden"
            onRetry={() => void publish()}
            retrying={publishing}
          />
        ) : null}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <div className="flex min-w-0 flex-col gap-4 md:flex-1">
            {editing === null && draft ? (
              <div className="md:hidden">
                <PublicationHeader requirements={requirements} status={status} />
              </div>
            ) : null}
            {editing === null && published ? (
              <div className="md:hidden">
                <OnSaleHeader event={event} sales={sales} status={status} />
              </div>
            ) : null}
            {editing === null ? (
              <EventSummary event={event} />
            ) : (
              <EditSection key={editing} event={event} section={editing} onDone={backToSummary} />
            )}
          </div>
          {aside === null ? null : (
            <aside className="hidden flex-col gap-6 md:flex md:w-dashboard-aside md:shrink-0">
              {aside}
            </aside>
          )}
        </div>
      </div>
      {showBar && draft ? (
        <>
          <BottomBar>
            <Button variant="inverse" size="m" onClick={() => setSheetOpen(true)}>
              Publicar evento
            </Button>
          </BottomBar>
          <PublishSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            event={event}
            requirements={requirements}
            publishing={publishing}
            failed={failed}
            onPublish={() => void publish()}
          />
        </>
      ) : null}
      {showBar && published ? <PublishedActions event={event} /> : null}
    </>
  );
}
