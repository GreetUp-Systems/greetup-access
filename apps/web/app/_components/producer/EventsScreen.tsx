"use client";

import { useEffect } from "react";

import { CreateEventButton, EventsCard } from "./EventsCard";
import { PageHeader } from "./PageHeader";
import { useProducer } from "./ProducerContext";

/** Figma: Desktop · Eventos (307:2983) and Mobile · Eventos (307:3341). */
export function EventsScreen() {
  const { events, reloadEvents } = useProducer();

  // The list may have changed since the system opened (an event created or published).
  useEffect(() => {
    void reloadEvents();
  }, [reloadEvents]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Eventos"
        description="Todos os seus eventos: à venda, rascunhos e encerrados."
        mobileDescription="Todos os seus eventos"
        actions={<CreateEventButton size="s" />}
      />
      <EventsCard events={events} />
    </div>
  );
}
