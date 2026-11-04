import type { Metadata } from "next";
import { Suspense } from "react";

import { EventDetailsScreen } from "../../../../../../../_components/producer/event/EventDetailsScreen";

export const metadata: Metadata = {
  title: "Detalhes do evento · Access",
};

export default function EventDetailsPage() {
  return (
    <Suspense>
      <EventDetailsScreen />
    </Suspense>
  );
}
