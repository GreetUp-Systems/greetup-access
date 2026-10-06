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
  /** The signed QR token, only for an issued ticket (SPEC-008 §6). */
  qrToken: string | null;
}

/** One of the buyer's tickets, with its QR token once issued; another user's answers 404. */
export function getTicket(token: string, ticketId: string): Promise<TicketView> {
  return apiRequest<TicketView>(`/me/tickets/${encodeURIComponent(ticketId)}`, { token });
}
