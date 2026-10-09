import { EventCover } from "@access/ui/components/event-cover";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Status } from "@access/ui/components/status";
import { Calendar, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "../../../_components/AppHeader";
import { EventPurchase } from "../../../_components/event/EventPurchase";
import { Providers } from "../../../_components/Providers";
import { getPublicEvent, type PublicEvent } from "../../../_lib/api/events";
import { formatEventEnd, formatEventStart } from "../../../_lib/format";
import { saleState } from "../../../_lib/ticket-selection";

// Rendered on the server: the shared link's preview and the content work without JavaScript
// (SPEC-014 §7). Availability changes all the time, so nothing is cached.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

// The review sends the buyer back with the chooser's Pix range notice (SPEC-014 §7).
const returnedNotices = {
  "valor-minimo": { kind: "below_minimum" },
  "valor-maximo": { kind: "above_maximum" },
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getPublicEvent((await params).slug);
  if (event === null) {
    return { title: "Evento não encontrado · Access" };
  }
  return {
    title: `${event.name} · Access`,
    description: `${formatEventStart(event.startsAt)} · ${event.venueName ?? event.address ?? ""}`,
  };
}

/** Figma: Página do evento (138:322 mobile, 140:931 desktop) and its closed-sales states. */
export default async function EventPage({ params, searchParams }: PageProps) {
  const event = await getPublicEvent((await params).slug);
  const aviso = (await searchParams)?.aviso;
  if (event === null) {
    notFound();
  }
  const sale = saleState(event, new Date());

  return (
    <Providers>
      <AppHeader />
      {/* The 16 margin stays outside the size/page-content column, so the column is 1200 wide. */}
      <div className="md:px-4">
        <main className="mx-auto w-full max-w-page-content pb-10 md:flex md:items-start md:gap-16 md:pt-8">
          <div className="min-w-0 flex-1">
            <EventCover className="-mt-top-bar md:mt-0" />
            <div className="relative -mt-12 flex flex-col gap-6 md:mt-10 md:gap-8">
              <header className="flex flex-col items-start gap-2 px-4 md:px-0">
                {event.status === "cancelled" ? (
                  <>
                    <Status status="cancelled" size="s" className="md:hidden" />
                    <Status status="cancelled" size="m" className="hidden md:inline-flex" />
                  </>
                ) : null}
                <h1 className="type-heading-h1 text-text-primary md:type-display-l">
                  {event.name}
                </h1>
                <p className="type-body-m text-text-secondary md:type-body-l">
                  Organizado por {event.producer.displayName}
                </p>
              </header>

              <EventInfo event={event} />

              {event.description !== null ? (
                <EventSection title="Sobre o evento">{event.description}</EventSection>
              ) : null}
              <EventSection title="Como funciona">
                Você paga por Pix e o ingresso com QR Code fica na sua conta, pronto para mostrar na
                entrada.
              </EventSection>
              {event.refundPolicy !== null ? (
                <EventSection title="Política de reembolso">{event.refundPolicy}</EventSection>
              ) : null}
              {/* Room for the floating purchase bar on the phone. */}
              <div className="h-bar md:hidden" aria-hidden />
            </div>
          </div>
          <EventPurchase
            event={event}
            sale={sale}
            initialNotice={
              typeof aviso === "string" && aviso in returnedNotices
                ? returnedNotices[aviso as keyof typeof returnedNotices]
                : null
            }
          />
        </main>
      </div>
    </Providers>
  );
}

/** Figma: Informações. Compact rows on the phone; a card of comfortable rows on the desktop. */
function EventInfo({ event }: { event: PublicEvent }) {
  const end = formatEventEnd(event.startsAt, event.endsAt);
  const place = event.venueName ?? event.address;
  const placeDetail = event.venueName !== null ? event.address : null;
  const mapsUrl =
    place === null
      ? null
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [event.venueName, event.address].filter(Boolean).join(", "),
        )}`;

  const rows = (size: "compact" | "comfortable") => (
    <>
      <Item size={size} divider={place !== null}>
        <ItemMedia>
          <Calendar />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{formatEventStart(event.startsAt)}</ItemTitle>
          {end !== null ? <ItemDescription>{end}</ItemDescription> : null}
        </ItemContent>
      </Item>
      {place !== null && mapsUrl !== null ? (
        <Item size={size} asChild>
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <ItemMedia>
              <MapPin />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{place}</ItemTitle>
              {placeDetail !== null ? <ItemDescription>{placeDetail}</ItemDescription> : null}
            </ItemContent>
            <ItemActions>
              <ChevronRight aria-hidden />
            </ItemActions>
          </a>
        </Item>
      ) : null}
    </>
  );

  return (
    <>
      <div className="flex flex-col md:hidden">{rows("compact")}</div>
      <div className="hidden flex-col rounded-lg border border-border-subtle bg-bg-surface py-1 md:flex">
        {rows("comfortable")}
      </div>
    </>
  );
}

function EventSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4 md:gap-3 md:px-0">
      <h2 className="type-heading-h4 text-text-primary md:type-heading-h3">{title}</h2>
      <p className="type-body-m whitespace-pre-line text-text-secondary md:type-body-l">
        {children}
      </p>
    </section>
  );
}
