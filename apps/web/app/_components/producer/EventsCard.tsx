"use client";

import { Button } from "@access/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@access/ui/components/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@access/ui/components/tabs";
import { cn } from "@access/ui/lib/utils";
import { Calendar, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { ProducerEvent } from "../../_lib/api/producer";
import { type EventTab, eventTabs, filterEvents, groupEvents } from "../../_lib/producer/events";
import { EmptyState } from "./EmptyState";
import { EventsList, EventsTable } from "./EventRows";

// Figma: Eventos · Aba vazia (432:3428, 432:3813), Busca sem resultado (432:3625) and the
// first event of the Painel (299:3865), whose text the empty À venda reuses.
const emptyTab: Record<EventTab, { title: string; description: string }> = {
  on_sale: {
    title: "Nenhum evento à venda",
    description: "Publique um rascunho para começar a vender.",
  },
  drafts: {
    title: "Nenhum rascunho",
    description: "O evento fica aqui enquanto você prepara, até publicar.",
  },
  ended: {
    title: "Nenhum evento encerrado",
    description: "Os eventos aparecem aqui depois que acontecem.",
  },
};

/** Figma: Botão/Inverso "Criar evento": S on the phone; M on the desktop or where `size` says. */
export function CreateEventButton({ size }: { size: "s" | "m" }) {
  return (
    <Button
      asChild
      variant="inverse"
      size={size}
      className={size === "s" ? "md:h-control-md md:px-4" : undefined}
    >
      <Link href="/producer/events/new">
        <Plus aria-hidden />
        Criar evento
      </Link>
    </Button>
  );
}

function SeeAllLink() {
  return (
    <Button asChild variant="ghost" size="s" className="shrink-0">
      <Link href="/producer/events">
        Ver todos
        <ChevronRight aria-hidden />
      </Link>
    </Button>
  );
}

interface EventsCardProps {
  events: readonly ProducerEvent[];
  /** On the Painel: "Ver todos" leads to Eventos, and the phone gets the "Seus eventos" title. */
  summary?: boolean;
  /** The tab it opens on; the Painel's setup opens on the drafts (SPEC-015 §6). */
  defaultTab?: EventTab;
  className?: string;
}

/**
 * Figma: the events card of Eventos (307:2983, 307:3341) and of the Painel (284:1571, 291:2431):
 * À venda, Rascunhos and Encerrados, with the search by name on the desktop (SPEC-015 §6).
 */
export function EventsCard({
  events,
  summary = false,
  defaultTab = "on_sale",
  className,
}: EventsCardProps) {
  const [tab, setTab] = useState<EventTab>(defaultTab);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupEvents(events, new Date()), [events]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as EventTab)}
      className={cn(
        "gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6",
        className,
      )}
    >
      {summary ? (
        <div className="flex items-center justify-between gap-2 md:hidden">
          <h2 className="type-heading-h4 text-text-primary">Seus eventos</h2>
          <SeeAllLink />
        </div>
      ) : null}
      <div className="flex items-end gap-6">
        <TabsList className="w-full gap-5 border-b border-border-subtle **:data-[slot=tabs-count]:hidden md:w-auto md:flex-1 md:gap-6 md:border-b-0 md:**:data-[slot=tabs-count]:flex">
          {eventTabs.map(({ tab: value, label }) => (
            <TabsTrigger key={value} value={value} count={groups[value].length}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <InputGroup size="s" className="hidden w-search-field md:flex">
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Buscar evento"
            aria-label="Buscar evento"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        {summary ? (
          <div className="hidden md:block">
            <SeeAllLink />
          </div>
        ) : null}
      </div>
      {eventTabs.map(({ tab: value, label }) => {
        const inTab = groups[value];
        const visible = filterEvents(inTab, query);
        return (
          <TabsContent key={value} value={value}>
            {inTab.length === 0 && value === "on_sale" && events.length === 0 ? (
              <EmptyState
                icon={<Calendar />}
                title="Crie seu primeiro evento"
                description="Data, local, tipos de ingresso e preço. Quando você publicar, as vendas aparecem aqui."
                action={<CreateEventButton size="m" />}
              />
            ) : inTab.length === 0 ? (
              <EmptyState icon={<Calendar />} {...emptyTab[value]} />
            ) : (
              <>
                <div className="hidden md:block">
                  {visible.length === 0 ? (
                    <EmptyState
                      icon={<Search />}
                      title="Nenhum evento encontrado"
                      description="Confira o nome ou busque de outro jeito."
                    />
                  ) : (
                    <EventsTable events={visible} label={label} />
                  )}
                </div>
                <div className="md:hidden">
                  <EventsList events={inTab} label={label} />
                </div>
              </>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
