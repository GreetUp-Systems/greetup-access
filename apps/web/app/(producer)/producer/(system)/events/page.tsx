import type { Metadata } from "next";

import { EventsScreen } from "../../../../_components/producer/EventsScreen";

export const metadata: Metadata = {
  title: "Eventos · Access",
};

export default function EventsPage() {
  return <EventsScreen />;
}
