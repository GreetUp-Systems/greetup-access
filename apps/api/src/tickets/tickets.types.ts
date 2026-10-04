export interface TicketsConfig {
  qrSecret: string;
  stellarNetwork: "testnet";
  ticketContractId: string;
}

export const TICKETS_CONFIG = Symbol("TICKETS_CONFIG");

export interface TicketOnchainView {
  contractId: string;
  tokenId: number;
  transactionHash: string | null;
  explorerUrl: string | null;
}

export interface TicketView {
  id: string;
  status: "pending_mint" | "issued";
  /** Readable code, AX- plus the token id (SPEC-008 v1.3); null until issued. */
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
  onchain: TicketOnchainView | null;
}

export interface TicketDetailView extends TicketView {
  qrToken: string | null;
}

export interface TicketListView {
  tickets: TicketView[];
}
