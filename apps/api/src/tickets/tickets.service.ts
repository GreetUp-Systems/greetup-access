import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { UsersRepository } from "../users/users.repository";
import { TicketQrService } from "./ticket-qr.service";
import { type OwnedTicketRecord, TicketsRepository } from "./tickets.repository";
import {
  TICKETS_CONFIG,
  type TicketDetailView,
  type TicketListView,
  type TicketsConfig,
  type TicketView,
} from "./tickets.types";

/** AX- plus the token id with at least 4 digits: unique on the contract (SPEC-008 v1.3). */
export function ticketCode(tokenId: number): string {
  return `AX-${String(tokenId).padStart(4, "0")}`;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tickets: TicketsRepository,
    private readonly qr: TicketQrService,
    @Inject(TICKETS_CONFIG) private readonly config: TicketsConfig,
  ) {}

  async list(principal: AuthenticatedPrincipal): Promise<TicketListView> {
    const userId = await this.requireUserId(principal);
    const tickets = await this.tickets.listOwned(userId);
    return { tickets: tickets.map((ticket) => this.toView(ticket)) };
  }

  async get(principal: AuthenticatedPrincipal, ticketId: string): Promise<TicketDetailView> {
    const userId = await this.requireUserId(principal);
    // RLS hides another user's ticket, so it is indistinguishable from a missing one.
    const ticket = await this.tickets.findOwned(userId, ticketId);
    if (ticket === null) {
      throw new NotFoundException({
        code: "ticket_not_found",
        message: "The ticket does not exist.",
      });
    }
    return {
      ...this.toView(ticket),
      qrToken: ticket.status === "ISSUED" ? this.qr.sign(ticket.id, ticket.ownerUserId) : null,
    };
  }

  private toView(ticket: OwnedTicketRecord): TicketView {
    const issued = ticket.status === "ISSUED" && ticket.tokenId !== null;
    return {
      id: ticket.id,
      status: issued ? "issued" : "pending_mint",
      code: issued ? ticketCode(ticket.tokenId!) : null,
      event: {
        id: ticket.event.id,
        slug: ticket.event.slug,
        name: ticket.event.name,
        status: ticket.event.status.toLowerCase() as TicketView["event"]["status"],
        startsAt: ticket.event.startsAt.toISOString(),
        endsAt: ticket.event.endsAt?.toISOString() ?? null,
        venueName: ticket.event.venueName,
        address: ticket.event.address,
      },
      ticketType: { id: ticket.ticketType.id, name: ticket.ticketType.name },
      purchaseId: ticket.purchaseId,
      issuedAt: ticket.issuedAt?.toISOString() ?? null,
      onchain: issued
        ? {
            contractId: this.config.ticketContractId,
            tokenId: ticket.tokenId!,
            transactionHash: ticket.mintTxHash,
            explorerUrl:
              ticket.mintTxHash === null
                ? null
                : `https://stellar.expert/explorer/${this.config.stellarNetwork}/tx/${ticket.mintTxHash}`,
          }
        : null,
    };
  }

  private async requireUserId(principal: AuthenticatedPrincipal): Promise<string> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    return user.id;
  }
}
