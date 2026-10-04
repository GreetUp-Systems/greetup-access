import { Prisma, PrismaService } from "@access/database";
import { Injectable } from "@nestjs/common";

const purchaseInclude = {
  tickets: { select: { status: true } },
  event: { select: { name: true, startsAt: true } },
  ticketType: { select: { name: true } },
  buyer: { select: { id: true, email: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseToNotify = Prisma.PurchaseGetPayload<{ include: typeof purchaseInclude }>;
export type EmailNotificationRecord = Prisma.EmailNotificationGetPayload<object>;

/** Runs on the access_worker role: it reads only the columns the e-mail needs (SPEC-008 §10). */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async purchaseOfTicket(ticketId: string): Promise<PurchaseToNotify | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { purchaseId: true },
    });
    if (ticket === null) {
      return null;
    }
    return this.prisma.purchase.findUnique({
      where: { id: ticket.purchaseId },
      include: purchaseInclude,
    });
  }

  /** One row per purchase: concurrent jobs converge on the same record. */
  async claimTicketsReady(purchaseId: string, userId: string): Promise<EmailNotificationRecord> {
    await this.prisma.emailNotification.createMany({
      data: [{ kind: "TICKETS_READY", referenceId: purchaseId, userId }],
      skipDuplicates: true,
    });
    return this.prisma.emailNotification.findUniqueOrThrow({
      where: { kind_referenceId: { kind: "TICKETS_READY", referenceId: purchaseId } },
    });
  }

  markSent(id: string, providerMessageId: string): Promise<EmailNotificationRecord> {
    return this.prisma.emailNotification.update({
      where: { id },
      data: { status: "SENT", providerMessageId, sentAt: new Date(), failureCode: null },
    });
  }

  markFailed(id: string, failureCode: string): Promise<EmailNotificationRecord> {
    return this.prisma.emailNotification.update({
      where: { id },
      data: { status: "FAILED", failureCode: failureCode.slice(0, 80) },
    });
  }
}
