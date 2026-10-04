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
  event: { id: string; slug: string; name: string; startsAt: string };
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
