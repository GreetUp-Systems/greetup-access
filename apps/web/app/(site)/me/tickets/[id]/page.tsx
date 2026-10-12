import type { Metadata } from "next";

import { TicketScreen } from "../../../../_components/tickets/TicketScreen";

export const metadata: Metadata = { title: "Ingresso · Access" };

/** `/me/tickets/[id]`: the opened ticket, among the tickets of its event (SPEC-014 M4). */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketScreen ticketId={id} />;
}
