import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

import { EMAIL_GATEWAY, type EmailGateway, EmailProviderError } from "./email.gateway";
import { NotificationsRepository } from "./notifications.repository";
import { ticketsReadyEmail } from "./tickets-ready-email";

export type NotifyOutcome = "sent" | "already_sent" | "tickets_pending" | "already_failed";

export const NOTIFY_CONFIG = Symbol("NOTIFY_CONFIG");

export interface NotifyConfig {
  appPublicUrl: string;
}

/**
 * SendTicketsReadyJob (SPEC-008 §8): one e-mail per purchase. Each ticket.issued triggers a job,
 * but only the one that finds every ticket issued sends; the record and the provider's
 * idempotency key keep repeated or concurrent jobs to a single e-mail.
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    @Inject(EMAIL_GATEWAY) private readonly email: EmailGateway,
    @Inject(NOTIFY_CONFIG) private readonly config: NotifyConfig,
  ) {}

  async ticketsReady(ticketId: string): Promise<NotifyOutcome> {
    const purchase = await this.repository.purchaseOfTicket(ticketId);
    if (purchase === null) {
      throw new UnrecoverableError("ticket_not_found");
    }
    // The last ticket is issued in the same transaction as its ticket.issued, so its job sees
    // every ticket issued; earlier jobs leave the e-mail to it.
    if (
      purchase.tickets.length === 0 ||
      purchase.tickets.some((ticket) => ticket.status !== "ISSUED")
    ) {
      return "tickets_pending";
    }

    const notification = await this.repository.claimTicketsReady(purchase.id, purchase.buyer.id);
    if (notification.status === "SENT") {
      return "already_sent";
    }
    if (notification.status === "FAILED") {
      return "already_failed";
    }

    const message = ticketsReadyEmail({
      to: purchase.buyer.email,
      eventName: purchase.event.name,
      eventStartsAt: purchase.event.startsAt,
      ticketTypeName: purchase.ticketType.name,
      quantity: purchase.tickets.length,
      appPublicUrl: this.config.appPublicUrl,
    });

    try {
      const sent = await this.email.send(message, `tickets-ready:${purchase.id}`);
      await this.repository.markSent(notification.id, sent.id);
      return "sent";
    } catch (error) {
      if (error instanceof EmailProviderError && !error.retryable) {
        await this.repository.markFailed(notification.id, error.code);
        this.logger.error(
          `Tickets-ready e-mail for purchase ${purchase.id} failed: ${error.code}.`,
        );
        throw new UnrecoverableError(error.code);
      }
      throw error;
    }
  }
}
