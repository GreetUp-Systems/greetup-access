"use client";

import { Button } from "@access/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
} from "@access/ui/components/carousel";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Ticket } from "@access/ui/components/ticket";
import { TopBar } from "@access/ui/components/top-bar";
import { ArrowLeft, Check, ChevronRight, Ticket as TicketIcon } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { TicketView } from "../../_lib/api/tickets";
import { formatTicketDateTime } from "../../_lib/format";
import {
  backHref,
  type EventTickets,
  eventDetail,
  groupByEvent,
  swipeCaption,
  ticketItem,
  ticketsHeading,
  ticketState,
  venueAndCity,
} from "../../_lib/site/tickets";
import { LoadFailed } from "../LoadFailed";
import { type TicketDetailState, useMyTickets } from "./MyTickets";
import { TicketLoading, TicketSkeleton } from "./TicketStates";

/** Emitindo: the ticket is read again every 5 s until it is issued (SPEC-014 M4). */
const ISSUING_POLL_MS = 5_000;

const ticketPath = (id: string) => `/me/tickets/${id}`;

/**
 * The opened ticket (SPEC-014 M3, M4; Figma 156:2434 and 154:3551, with the states of 465:7844 to
 * 465:7950). The route names one ticket; the screen shows the tickets of its event with that one
 * selected. Desktop: the event, the list of its tickets and the selected Ingresso beside them;
 * choosing another one changes the route. Phone: the Barra superior and the tickets in a carousel,
 * swiping changes the route without leaving the screen (M11). The QR comes from the ticket read on
 * its own, never from the list, and only for a valid ticket of an event not cancelled.
 */
export function TicketScreen({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { state: list, retry, details, readTickets } = useMyTickets();
  // The ticket in view: the route's, then the one swiped to.
  const [selectedId, setSelectedId] = useState(ticketId);
  useEffect(() => setSelectedId(ticketId), [ticketId]);
  const [now] = useState(() => new Date());

  const routeDetail = details[ticketId];
  const group = useMemo<EventTickets | null>(() => {
    if (list.status === "ready") {
      const listed = list.tickets.find((ticket) => ticket.id === ticketId);
      if (listed !== undefined) {
        return groupByEvent(list.tickets).find((each) => each.event.id === listed.event.id) ?? null;
      }
    }
    // Not in the list (it failed, or the ticket is past its 200): the ticket alone, once read.
    if (routeDetail?.status === "ready") {
      return { event: routeDetail.ticket.event, tickets: [routeDetail.ticket] };
    }
    return null;
  }, [list, ticketId, routeDetail]);

  // The route's ticket at once; the others of its event as soon as the list names them.
  const groupIds = group?.tickets.map((ticket) => ticket.id).join(",") ?? "";
  useEffect(() => {
    readTickets([ticketId, ...(groupIds === "" ? [] : groupIds.split(","))]);
  }, [readTickets, ticketId, groupIds]);

  // The latest of each ticket: read on its own when it was, from the list otherwise.
  const latest = useCallback(
    (ticket: TicketView): TicketView => {
      const detail = details[ticket.id];
      return detail?.status === "ready" ? detail.ticket : ticket;
    },
    [details],
  );
  const issuing =
    group?.tickets
      .filter((ticket) => ticketState(latest(ticket)) === "issuing")
      .map((ticket) => ticket.id)
      .join(",") ?? "";
  useEffect(() => {
    if (issuing === "") {
      return;
    }
    const timer = window.setInterval(() => readTickets(issuing.split(","), true), ISSUING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [issuing, readTickets]);

  const selectFromSwipe = useCallback(
    (index: number) => {
      const ticket = group?.tickets[index];
      if (ticket === undefined) {
        return;
      }
      setSelectedId(ticket.id);
      // The route follows without a navigation, so the carousel stays where it is (M11).
      window.history.replaceState(null, "", ticketPath(ticket.id));
    },
    [group],
  );

  if (routeDetail?.status === "not_found") {
    notFound();
  }
  if (group === null) {
    const failed = list.status === "failed" || routeDetail?.status === "failed";
    return failed ? (
      <LoadFailed
        onRetry={() => {
          retry();
          readTickets([ticketId]);
        }}
      />
    ) : (
      <TicketLoading />
    );
  }

  const { event, tickets } = group;
  const selectedIndex = Math.max(
    0,
    tickets.findIndex((ticket) => ticket.id === selectedId),
  );
  const selected = tickets[selectedIndex] ?? tickets[0];
  const back = backHref(event, now);
  const cancelled = event.status === "cancelled";
  const caption = swipeCaption(selectedIndex, tickets.length);
  const opened = (ticket: TicketView) => (
    <OpenedTicket
      ticket={latest(ticket)}
      detail={details[ticket.id]}
      onRetry={() => readTickets([ticket.id])}
    />
  );

  return (
    <>
      {/* Phone: the Barra superior, over the frame's margin, with the back (M8). */}
      <div className="-mx-4 -mt-2 md:hidden">
        <TopBar type="navigation" title={event.name} onBack={() => router.push(back)} />
      </div>
      <Button asChild variant="secondary" size="icon-m" className="hidden md:inline-flex">
        <Link href={back} aria-label="Voltar">
          <ArrowLeft aria-hidden />
        </Link>
      </Button>

      <div className="mt-3 flex flex-col md:mt-4 md:flex-row md:items-start md:gap-16">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="sr-only md:not-sr-only md:type-heading-h1 md:text-text-primary">
            {event.name}
          </h1>
          <div className="hidden md:contents">
            <p className="mt-2 type-body-l text-text-secondary">{eventDetail(event)}</p>
            <h2 className="mt-8 type-heading-h4 text-text-primary">
              {ticketsHeading(tickets.length)}
            </h2>
            <ul className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
              {tickets.map((ticket, index) => {
                const item = ticketItem(latest(ticket), index + 1);
                const current = ticket.id === selected?.id;
                return (
                  <li key={ticket.id}>
                    <Item asChild selected={current} divider={index < tickets.length - 1}>
                      <Link
                        href={ticketPath(ticket.id)}
                        replace
                        scroll={false}
                        aria-current={current ? "page" : undefined}
                      >
                        <ItemMedia>
                          <TicketIcon />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{item.title}</ItemTitle>
                          <ItemDescription>{item.code}</ItemDescription>
                        </ItemContent>
                        <ItemActions>{current ? <Check /> : <ChevronRight />}</ItemActions>
                      </Link>
                    </Item>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 type-body-m text-text-secondary">
              {cancelled
                ? "Este evento foi cancelado. Fale com quem organiza sobre o reembolso."
                : "Mostre o QR Code na entrada. Cada ingresso vale uma entrada e só pode ser lido uma vez."}
            </p>
          </div>
        </div>

        <div className="md:w-1/3 md:shrink-0">
          <div className="md:hidden">
            <Carousel
              opts={{ startIndex: selectedIndex }}
              onSelectedIndexChange={selectFromSwipe}
              aria-label={ticketsHeading(tickets.length)}
            >
              <CarouselContent>
                {tickets.map((ticket) => (
                  <CarouselItem key={ticket.id}>{opened(ticket)}</CarouselItem>
                ))}
              </CarouselContent>
              <CarouselDots className="mt-4" />
            </Carousel>
            {caption === null ? null : (
              <p className="mt-2-5 text-center type-body-s text-text-tertiary">{caption}</p>
            )}
          </div>
          <div className="hidden md:block">{selected === undefined ? null : opened(selected)}</div>
        </div>
      </div>
    </>
  );
}

/**
 * The Ingresso of one ticket: Cancelado and Emitindo straight from what is known; Válido needs the
 * ticket read on its own, for the QR, and is an esqueleto until then.
 */
function OpenedTicket({
  ticket,
  detail,
  onRetry,
}: {
  ticket: TicketView;
  detail: TicketDetailState | undefined;
  onRetry: () => void;
}) {
  const state = ticketState(ticket);
  if (state === "valid" && detail?.status === "failed") {
    return <LoadFailed onRetry={onRetry} />;
  }
  if (state === "valid" && detail?.status !== "ready") {
    return <TicketSkeleton />;
  }
  const qrToken = state === "valid" && detail?.status === "ready" ? detail.ticket.qrToken : null;
  return (
    <Ticket
      state={state}
      eventName={ticket.event.name}
      dateTime={formatTicketDateTime(ticket.event.startsAt)}
      place={venueAndCity(ticket.event)}
      ticketTypeName={ticket.ticketType.name}
      code={ticket.code}
      qrValue={qrToken ?? undefined}
    />
  );
}
