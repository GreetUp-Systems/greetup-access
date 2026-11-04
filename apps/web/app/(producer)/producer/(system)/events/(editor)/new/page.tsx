import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateEventScreen } from "../../../../../../_components/producer/event/CreateEventScreen";

export const metadata: Metadata = {
  title: "Novo evento · Access",
};

export default function NewEventPage() {
  return (
    <Suspense>
      <CreateEventScreen />
    </Suspense>
  );
}
