import { apiRequest } from "./client";

// Mirror of the ticket view (apps/api/src/tickets/tickets.types.ts, SPEC-008 §5).
export interface TicketView {
  id: string;
  status: "pending_mint" | "issued";
  /** "AX-0042"; null while pending_mint. */
  code: string | null;
  event: {
    id: string;
    slug: string;
    name: string;
    status: "draft" | "published" | "cancelled";
    startsAt: string;
    endsAt: string | null;
    venueName: string | null;
    address: string | null;
    /** The event's cover (SPEC-015, D-30); null without one, and the brand's art shows instead. */
    coverUrl: string | null;
    /** The IBGE city (SPEC-008 v1.5); null on an event without one. */
    city: { code: number; name: string; uf: string } | null;
  };
  ticketType: { id: string; name: string };
  purchaseId: string;
  issuedAt: string | null;
  onchain: {
    contractId: string;
    tokenId: number;
    transactionHash: string | null;
    explorerUrl: string | null;
  } | null;
}

/** One ticket read on its own: the list's item plus the QR token. */
export interface TicketDetailView extends TicketView {
  /** The signed QR token, only for an issued ticket (SPEC-008 §6). */
  qrToken: string | null;
}

/** The buyer's tickets, by event date and then issuance, up to 200 (SPEC-008 §5). */
export function listTickets(
  token: string,
  signal?: AbortSignal,
): Promise<{ tickets: TicketView[] }> {
  return apiRequest<{ tickets: TicketView[] }>("/me/tickets", {
    token,
    ...(signal === undefined ? {} : { signal }),
  });
}

/** One of the buyer's tickets, with its QR token once issued; another user's answers 404. */
export function getTicket(
  token: string,
  ticketId: string,
  signal?: AbortSignal,
): Promise<TicketDetailView> {
  return apiRequest<TicketDetailView>(`/me/tickets/${encodeURIComponent(ticketId)}`, {
    token,
    ...(signal === undefined ? {} : { signal }),
  });
}
