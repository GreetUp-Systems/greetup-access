import type { ReactNode } from "react";

import { EventFlowProvider } from "../../../../../_components/producer/event/EventFlowProvider";

/**
 * The event's pages (SPEC-015 §6, E4): the creation, the details and the event page share one flow
 * in this layout's memory, so going back from the details to the creation shows what was saved
 * and the passos keep what was typed.
 */
export default function EventEditorLayout({ children }: { children: ReactNode }) {
  return <EventFlowProvider>{children}</EventFlowProvider>;
}
