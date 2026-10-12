import type { ReactNode } from "react";

import { MyTicketsProvider } from "../../../_components/tickets/MyTickets";

/**
 * Meus ingressos and the opened ticket (SPEC-014 9D) share the buyer's list: it is read once, and
 * moving between the tickets of an event only changes the route (M11).
 */
export default function MyTicketsLayout({ children }: { children: ReactNode }) {
  return <MyTicketsProvider>{children}</MyTicketsProvider>;
}
