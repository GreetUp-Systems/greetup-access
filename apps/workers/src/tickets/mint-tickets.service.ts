import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

import {
  TICKET_CONTRACT_GATEWAY,
  TicketContractError,
  type TicketContractGateway,
} from "../chain/ticket-contract.gateway";
import { MintTicketsRepository } from "./mint-tickets.repository";

export type MintOutcome = "issued" | "already_issued" | "not_payable";

/**
 * MintTicketJob (SPEC-005 §11). Every step re-reads state, so a retried or repeated job converges
 * to the same tickets: the contract returns the same token for the same ticket id.
 */
@Injectable()
export class MintTicketsService {
  private readonly logger = new Logger(MintTicketsService.name);

  constructor(
    private readonly repository: MintTicketsRepository,
    @Inject(TICKET_CONTRACT_GATEWAY) private readonly contract: TicketContractGateway,
  ) {}

  async mintPurchase(purchaseId: string): Promise<MintOutcome> {
    const purchase = await this.repository.findPurchase(purchaseId);
    if (purchase === null) {
      throw new UnrecoverableError("purchase_not_found");
    }
    if (purchase.status === "TICKET_ISSUED") {
      return "already_issued";
    }
    if (purchase.status !== "PAYMENT_CONFIRMED") {
      this.logger.warn(`Purchase ${purchaseId} is ${purchase.status}; nothing to mint.`);
      return "not_payable";
    }

    const address = await this.repository.buyerAddress(purchase.buyerUserId);
    if (address === null) {
      throw new UnrecoverableError("buyer_wallet_not_found");
    }

    try {
      await this.syncCapacity(purchase.event.id, purchase.event.capacity);
      for (const ticket of purchase.tickets) {
        if (ticket.status !== "PENDING_MINT") {
          continue;
        }
        const minted = await this.contract.mint(ticket.id, purchase.event.id, address);
        await this.repository.markIssued(
          ticket.id,
          purchase.id,
          minted.tokenId,
          minted.transactionHash,
        );
      }
    } catch (error) {
      // A contract rejection will not change on retry; RPC and network failures will.
      if (error instanceof TicketContractError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }

    await this.repository.completeIfIssued(purchase.id);
    return "issued";
  }

  // The database owns the capacity; the contract mirrors it before minting (SPEC-005 §11).
  private async syncCapacity(eventId: string, capacity: number): Promise<void> {
    const onChain = await this.contract.event(eventId);
    if (onChain === null || onChain.capacity !== capacity) {
      await this.contract.setEventCapacity(eventId, capacity);
    }
  }
}
