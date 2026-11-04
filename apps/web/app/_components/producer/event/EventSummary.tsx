"use client";

import { Button } from "@access/ui/components/button";
import { EventThumbnail } from "@access/ui/components/event-cover";
import { cn } from "@access/ui/lib/utils";
import {
  Calendar,
  FileText,
  type LucideIcon,
  MapPin,
  Tag,
  Ticket,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";

import type { EventDetail } from "../../../_lib/api/producer-events";
import { editHref } from "../../../_lib/producer/event-flow";
import {
  type EventSection,
  eventSections,
  sectionSummary,
  sectionTitles,
} from "../../../_lib/producer/event-sections";
import { categoryIcons } from "./EventFields";
import { useEventFlow } from "./EventFlowProvider";

const sectionIcons: Record<Exclude<EventSection, "nome" | "capa">, LucideIcon> = {
  data: Calendar,
  capacidade: Users,
  local: MapPin,
  ingressos: Ticket,
  descricao: FileText,
};

/** The section's picture: its icon in a tile, the category's for Nome, the cover's thumbnail. */
function SectionMedia({ section, event }: { section: EventSection; event: EventDetail }) {
  const size = "size-8 md:size-control-md";
  if (section === "capa" && event.coverUrl !== null) {
    return <EventThumbnail src={event.coverUrl} className={size} />;
  }
  let Icon: LucideIcon;
  if (section === "capa") {
    Icon = Upload;
  } else if (section === "nome") {
    Icon = event.category === null ? Tag : categoryIcons[event.category];
  } else {
    Icon = sectionIcons[section];
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-secondary [&>svg]:size-icon-sm md:[&>svg]:size-icon-md",
        size,
      )}
    >
      <Icon />
    </span>
  );
}

/**
 * Figma: Informações do evento, the summary by section (Evento · Rascunho, 591:12579 and 591:12345;
 * Publicado, 592:12678 and 592:12539): each section's picture, title and summary, and "Editar",
 * which opens its edition at `?editar=<seção>`. A section the publication still needs is said in
 * text/warning. Desktop: a card with its title; phone: the list alone. A cancelled event is not
 * edited (SPEC-004 §5).
 */
export function EventSummary({ event }: { event: EventDetail }) {
  const flow = useEventFlow();
  const editable = event.status !== "cancelled";
  return (
    <section
      aria-labelledby="event-summary-title"
      className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface md:gap-4 md:rounded-xl md:p-6"
    >
      <div className="sr-only flex-col gap-1 md:not-sr-only md:flex">
        <h2 id="event-summary-title" className="type-heading-h4 text-text-primary">
          Informações do evento
        </h2>
        <p className="type-body-s text-text-tertiary">
          O que aparece na vitrine e na página do evento. Edite cada parte quando quiser.
        </p>
      </div>
      <ul className="flex flex-col">
        {eventSections.map((section) => {
          const summary = sectionSummary(section, event);
          const href = editHref(event.id, section);
          return (
            <li
              key={section}
              className="flex items-center gap-3 border-b border-border-subtle px-4 py-2 last:border-b-0 md:gap-4 md:px-0 md:py-3"
            >
              <SectionMedia section={section} event={event} />
              <div className="flex min-w-0 flex-1 flex-col gap-0-5">
                <h3 className="type-body-m-strong text-text-primary">{sectionTitles[section]}</h3>
                <p
                  className={cn(
                    "truncate type-body-s",
                    summary.missing ? "text-text-warning" : "text-text-secondary",
                  )}
                >
                  {summary.text}
                </p>
              </div>
              {editable ? (
                <Button asChild variant="ghost" size="s">
                  <Link
                    href={href}
                    aria-label={`Editar ${sectionTitles[section]}`}
                    onClick={() => flow.reachForward(href)}
                  >
                    Editar
                  </Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
