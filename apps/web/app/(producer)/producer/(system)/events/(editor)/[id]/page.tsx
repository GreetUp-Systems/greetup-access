import type { Metadata } from "next";
import { Suspense } from "react";

import { EventScreen } from "../../../../../../_components/producer/event/EventScreen";

export const metadata: Metadata = {
  title: "Evento · Access",
};

export default function EventPage() {
  return (
    <Suspense>
      <EventScreen />
    </Suspense>
  );
}
