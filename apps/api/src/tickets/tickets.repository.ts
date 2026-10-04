import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

const ticketInclude = {
  event: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      address: true,
    },
  },
  ticketType: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

export type OwnedTicketRecord = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** No pagination in the MVP; the list is capped (SPEC-008 §5). */
export const ownedTicketsLimit = 200;

@Injectable()
export class TicketsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  listOwned(userId: string): Promise<OwnedTicketRecord[]> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.ticket.findMany({
        where: { ownerUserId: userId },
        include: ticketInclude,
        orderBy: [{ event: { startsAt: "asc" } }, { issuedAt: "asc" }, { createdAt: "asc" }],
        take: ownedTicketsLimit,
      }),
    );
  }

  findOwned(userId: string, ticketId: string): Promise<OwnedTicketRecord | null> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.ticket.findFirst({
        where: { id: ticketId, ownerUserId: userId },
        include: ticketInclude,
      }),
    );
  }
}
