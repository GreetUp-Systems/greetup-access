import { Prisma, PrismaService } from "@access/database";
import { Injectable } from "@nestjs/common";

const mintInclude = {
  tickets: { orderBy: { createdAt: "asc" } },
  event: { select: { id: true, capacity: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseToMint = Prisma.PurchaseGetPayload<{ include: typeof mintInclude }>;

/** Runs on the access_worker role, whose policies only let it advance minting states. */
@Injectable()
export class MintTicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPurchase(purchaseId: string): Promise<PurchaseToMint | null> {
    return this.prisma.purchase.findUnique({ where: { id: purchaseId }, include: mintInclude });
  }

  async buyerAddress(userId: string): Promise<string | null> {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { userId },
      select: { stellarAddress: true },
    });
    return wallet?.stellarAddress ?? null;
  }

  // The ticket and ticket.issued are written in one transaction (D-14).
  markIssued(
    ticketId: string,
    purchaseId: string,
    tokenId: number,
    transactionHash: string | null,
  ): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ticket.updateMany({
        where: { id: ticketId, status: "PENDING_MINT" },
        data: {
          status: "ISSUED",
          tokenId,
          mintTxHash: transactionHash,
          issuedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        return;
      }
      await transaction.outboxEvent.createMany({
        data: [
          {
            deduplicationKey: `ticket:${ticketId}:issued:v1`,
            aggregateType: "ticket",
            aggregateId: ticketId,
            eventType: "ticket.issued",
            payload: { ticketId, purchaseId },
          },
        ],
        skipDuplicates: true,
      });
    });
  }

  async completeIfIssued(purchaseId: string): Promise<boolean> {
    const pending = await this.prisma.ticket.count({
      where: { purchaseId, status: "PENDING_MINT" },
    });
    if (pending > 0) {
      return false;
    }
    await this.prisma.purchase.updateMany({
      where: { id: purchaseId, status: "PAYMENT_CONFIRMED" },
      data: { status: "TICKET_ISSUED" },
    });
    return true;
  }
}
