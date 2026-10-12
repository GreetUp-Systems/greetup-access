import type { Metadata } from "next";

import { TicketsScreen } from "../../../_components/tickets/TicketsScreen";
import { ticketsTab } from "../../../_lib/site/tickets";

export const metadata: Metadata = { title: "Meus ingressos · Access" };

/** `/me/tickets` and `/me/tickets?aba=anteriores`: Meus ingressos (SPEC-014 9D, M2). */
export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>;
}) {
  const { aba } = await searchParams;
  return <TicketsScreen tab={ticketsTab(aba)} />;
}
