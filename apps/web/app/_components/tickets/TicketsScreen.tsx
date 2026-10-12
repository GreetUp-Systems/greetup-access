"use client";

import { Button } from "@access/ui/components/button";
import { EventCard } from "@access/ui/components/event-card";
import { SegmentedControl, SegmentedControlItem } from "@access/ui/components/segmented-control";
import { Tabs, TabsContent } from "@access/ui/components/tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { formatEventStart, formatShortDateTime } from "../../_lib/format";
import {
  cardState,
  countdown,
  dateAndCity,
  type EventTickets,
  groupByEvent,
  sharedTicketType,
  splitByTab,
  ticketCount,
  ticketsHref,
  ticketsLine,
  type TicketsTab,
  venueAndAddress,
  venueAndCity,
} from "../../_lib/site/tickets";
import { LoadFailed } from "../LoadFailed";
import { useMyTickets } from "./MyTickets";
import { TicketsEmpty, TicketsLoading } from "./TicketsStates";

const ticketHref = (group: EventTickets) => `/me/tickets/${group.tickets[0]?.id ?? ""}`;

/**
 * Meus ingressos (SPEC-014 9D; Figma 150:2853 and 146:2582, Anteriores 157:2232 and 157:2067):
 * one card per event (M1), Próximos and Anteriores in the Controle segmentado, the tab in the URL
 * (M2). Próximos: the next event in the Destaque largo on the desktop (the Destaque on the phone) and
 * the others under "Mais próximos", in a grid of three or in rows (M6). Anteriores: rows, four a line
 * on the desktop. Every card opens its event's first ticket (M7).
 */
export function TicketsScreen({ tab: routeTab }: { tab: TicketsTab }) {
  const router = useRouter();
  const { state, retry } = useMyTickets();
  // The tab answers at once; the route follows, and the browser's back and forward move it again.
  const [tab, setTab] = useState(routeTab);
  useEffect(() => setTab(routeTab), [routeTab]);
  const [now] = useState(() => new Date());
  const tabs = useMemo(
    () => (state.status === "ready" ? splitByTab(groupByEvent(state.tickets), now) : null),
    [state, now],
  );

  const changeTab = (value: string) => {
    const next: TicketsTab = value === "past" ? "past" : "upcoming";
    setTab(next);
    router.replace(ticketsHref(next), { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="gap-4 md:gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="type-heading-h1 text-text-primary">Meus ingressos</h1>
        <SegmentedControl aria-label="Meus ingressos" className="md:w-segmented-control">
          <SegmentedControlItem value="upcoming">Próximos</SegmentedControlItem>
          <SegmentedControlItem value="past">Anteriores</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <TabsContent value={tab}>
        {state.status === "failed" ? (
          <LoadFailed onRetry={retry} />
        ) : tabs === null ? (
          <TicketsLoading />
        ) : tab === "upcoming" ? (
          <Upcoming groups={tabs.upcoming} hasPast={tabs.past.length > 0} now={now} />
        ) : (
          <Past groups={tabs.past} now={now} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Upcoming({
  groups,
  hasPast,
  now,
}: {
  groups: EventTickets[];
  hasPast: boolean;
  now: Date;
}) {
  const [next, ...others] = groups;
  if (next === undefined) {
    // With nothing at all, the empty state; with only past events, where they are (M13).
    return hasPast ? (
      <TicketsEmpty
        title="Nenhum evento pela frente"
        description="Os ingressos de eventos que já passaram estão em Anteriores."
      />
    ) : (
      <TicketsEmpty
        title="Nenhum ingresso por aqui"
        description="Quando você comprar um ingresso, ele aparece aqui com o QR Code para a entrada."
      />
    );
  }

  return (
    <>
      <NextEvent group={next} now={now} />
      {others.length === 0 ? null : (
        <section aria-labelledby="mais-proximos" className="mt-3 md:mt-10">
          <h2 id="mais-proximos" className="type-heading-h4 text-text-primary md:type-heading-h3">
            Mais próximos
          </h2>
          {/* Phone: rows. */}
          <ul className="mt-3 flex flex-col gap-3 md:hidden">
            {others.map((group) => (
              <li key={group.event.id}>
                <EventCard
                  asChild
                  type="row"
                  state="default"
                  title={group.event.name}
                  coverUrl={group.event.coverUrl}
                  detail={dateAndCity(group.event)}
                  tickets={ticketsLine(group.tickets)}
                >
                  <Link href={ticketHref(group)} />
                </EventCard>
              </li>
            ))}
          </ul>
          {/* Desktop: a grid of three. */}
          <ul className="mt-5 hidden grid-cols-3 gap-6 md:grid">
            {others.map((group) => (
              <li key={group.event.id} className="flex">
                <EventCard
                  asChild
                  type="feature"
                  title={group.event.name}
                  coverUrl={group.event.coverUrl}
                  date={formatShortDateTime(group.event.startsAt)}
                  place={venueAndCity(group.event)}
                  countdown={countdown(group.event, now)}
                  badges={badges(group)}
                  className="w-full"
                >
                  <Link href={ticketHref(group)} />
                </EventCard>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function badges(group: EventTickets): string[] {
  const type = sharedTicketType(group.tickets);
  const count = ticketCount(group.tickets.length);
  return type === null ? [count] : [count, type];
}

/** The next event: the Destaque on the phone, the Destaque largo on the desktop. */
function NextEvent({ group, now }: { group: EventTickets; now: Date }) {
  const { event } = group;
  const show = (
    <Button asChild variant="inverse" size="l">
      <Link href={ticketHref(group)}>Mostrar ingresso</Link>
    </Button>
  );
  return (
    <>
      <EventCard
        type="feature"
        heading="h2"
        title={event.name}
        coverUrl={event.coverUrl}
        date={formatShortDateTime(event.startsAt)}
        place={venueAndCity(event)}
        countdown={countdown(event, now)}
        badges={badges(group)}
        action={show}
        className="md:hidden"
      />
      <EventCard
        type="wide"
        heading="h2"
        title={event.name}
        coverUrl={event.coverUrl}
        date={formatEventStart(event.startsAt)}
        place={venueAndAddress(event)}
        countdown={countdown(event, now)}
        badges={badges(group)}
        action={show}
        secondaryAction={
          <Button asChild variant="ghost" size="l">
            <Link href={`/e/${event.slug}`}>Ver evento</Link>
          </Button>
        }
        className="hidden md:flex"
      />
    </>
  );
}

function Past({ groups, now }: { groups: EventTickets[]; now: Date }) {
  if (groups.length === 0) {
    return (
      <TicketsEmpty
        title="Nenhum evento anterior"
        description="Os eventos que já passaram aparecem aqui."
      />
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-4 md:gap-6">
      {groups.map((group) => (
        <li key={group.event.id} className="flex">
          <EventCard
            asChild
            type="row"
            state={cardState(group.event, now) === "cancelled" ? "cancelled" : "past"}
            title={group.event.name}
            coverUrl={group.event.coverUrl}
            detail={dateAndCity(group.event)}
            className="w-full"
          >
            <Link href={ticketHref(group)} />
          </EventCard>
        </li>
      ))}
    </ul>
  );
}
