"use client";

import { Button } from "@access/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@access/ui/components/dropdown-menu";
import { EventThumbnail } from "@access/ui/components/event-cover";
import { Progress } from "@access/ui/components/progress";
import { Status } from "@access/ui/components/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@access/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@access/ui/components/tooltip";
import { Check, Ellipsis, ExternalLink, Link as LinkIcon, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ProducerEvent } from "../../_lib/api/producer";
import { formatAmount, formatTicketDateTime } from "../../_lib/format";
import { eventPlace, eventStatus, hasPublicPage, soldPercent } from "../../_lib/producer/events";

const thumbnail = "size-control-md md:size-control-md";
const editorHref = (event: ProducerEvent) => `/producer/events/${event.id}`;

/**
 * The event's name is the link of its whole line: it covers the row, underlines on hover
 * (Desktop · Eventos · Linha em hover, 437:16993) and draws the inner focus border of a list item.
 */
function EventLink({ event }: { event: ProducerEvent }) {
  return (
    <Link
      href={editorHref(event)}
      className="truncate type-body-m-strong text-text-primary outline-none group-hover/row:underline after:absolute after:inset-0 after:rounded-md focus-visible:after:inset-ring-2 focus-visible:after:inset-ring-border-accent"
    >
      {event.name}
    </Link>
  );
}

function Sold({ event }: { event: ProducerEvent }) {
  return (
    <span className="type-body-s text-text-secondary">
      {event.soldTickets} de {event.capacity}
    </span>
  );
}

/**
 * Figma: Ações do evento (410:3081), from the row's "⋯": Editar, and for a published event Ver
 * página and Copiar link, which turns into "Link copiado" (410:16610) before the menu closes.
 */
function EventActions({ event }: { event: ProducerEvent }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicPath = `/e/${event.slug}`;

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setOpen(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCopied(false);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-s" aria-label={`Ações de ${event.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Ações do evento</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-menu">
        <DropdownMenuItem asChild>
          <Link href={editorHref(event)}>
            <Pencil aria-hidden />
            Editar
          </Link>
        </DropdownMenuItem>
        {hasPublicPage(event) ? (
          <>
            <DropdownMenuItem asChild>
              <a href={publicPath} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Ver página
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(selection) => {
                // Stays open to say the link was copied.
                selection.preventDefault();
                void navigator.clipboard
                  .writeText(`${window.location.origin}${publicPath}`)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
            >
              {copied ? <Check aria-hidden /> : <LinkIcon aria-hidden />}
              {copied ? "Link copiado" : "Copiar link"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Figma: the table of Eventos (307:2983) and of the Painel's events: the event with its place,
 * the date, the status, sold over capacity with Progresso, the revenue in Mono/M and the "⋯". A
 * draft is not on sale yet, so it has no sales.
 */
export function EventsTable({
  events,
  label,
}: {
  events: readonly ProducerEvent[];
  label: string;
}) {
  const now = new Date();
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableHead className="flex-1">Evento</TableHead>
        <TableHead className="w-column-l shrink-0">Data</TableHead>
        <TableHead className="w-column-s shrink-0">Status</TableHead>
        <TableHead className="w-column-xl shrink-0">Vendidos</TableHead>
        <TableHead className="w-column-m shrink-0 text-right">Receita</TableHead>
        <TableHead className="w-control-sm shrink-0">
          <span className="sr-only">Ações</span>
        </TableHead>
      </TableHeader>
      <TableBody>
        {events.map((event) => {
          const place = eventPlace(event);
          const draft = event.status === "draft";
          return (
            <TableRow key={event.id} className="group/row">
              <TableCell className="flex flex-1 items-center gap-3">
                <EventThumbnail src={event.coverUrl} className={thumbnail} />
                <div className="flex min-w-0 flex-col gap-0-5">
                  <EventLink event={event} />
                  {place === null ? null : (
                    <span className="truncate type-body-s text-text-tertiary">{place}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-column-l shrink-0 type-body-m text-text-secondary">
                {formatTicketDateTime(event.startsAt)}
              </TableCell>
              <TableCell className="w-column-s shrink-0">
                <Status status={eventStatus(event, now)} />
              </TableCell>
              <TableCell className="flex w-column-xl shrink-0 flex-col gap-2">
                {draft ? (
                  <span className="type-body-s text-text-tertiary">Ainda não está à venda</span>
                ) : (
                  <>
                    <Sold event={event} />
                    <Progress value={soldPercent(event)} aria-label="Vendidos" />
                  </>
                )}
              </TableCell>
              <TableCell className="w-column-m shrink-0 text-right type-mono-m">
                {draft ? (
                  <span className="text-text-tertiary">—</span>
                ) : (
                  <>
                    <span className="text-text-tertiary">R$</span>{" "}
                    <span className="text-text-primary">{formatAmount(event.salesCents)}</span>
                  </>
                )}
              </TableCell>
              {/* Above the row's link, so the menu opens instead of the event. */}
              <TableCell className="relative z-10 w-control-sm shrink-0">
                <EventActions event={event} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Figma: the list of Mobile · Eventos (307:3341): the event with its date and status, then sold
 * over capacity with Progresso; rows split by border/subtle, each one a link to the event.
 */
export function EventsList({ events, label }: { events: readonly ProducerEvent[]; label: string }) {
  const now = new Date();
  return (
    <ul aria-label={label} className="flex flex-col gap-4">
      {events.map((event) => (
        <li
          key={event.id}
          className="group/row relative flex flex-col gap-3 border-b border-border-subtle pb-4 last:border-b-0 last:pb-0"
        >
          <div className="flex items-center gap-3">
            <EventThumbnail src={event.coverUrl} className={thumbnail} />
            <div className="flex min-w-0 flex-1 flex-col gap-0-5">
              <EventLink event={event} />
              <span className="truncate type-body-s text-text-tertiary">
                {formatTicketDateTime(event.startsAt)}
              </span>
            </div>
            <Status status={eventStatus(event, now)} />
          </div>
          {event.status === "draft" ? (
            <span className="type-body-s text-text-tertiary">Ainda não está à venda</span>
          ) : (
            <div className="flex items-center gap-3">
              <Progress value={soldPercent(event)} aria-label="Vendidos" className="flex-1" />
              <Sold event={event} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
