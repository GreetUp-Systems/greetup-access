import { UnrecoverableError } from "bullmq";

import { type EmailGateway, EmailProviderError } from "./email.gateway";
import {
  type EmailNotificationRecord,
  type NotificationsRepository,
  type PurchaseToNotify,
} from "./notifications.repository";
import { NotifyService } from "./notify.service";
import { ticketsReadyEmail } from "./tickets-ready-email";

const purchaseId = "00000000-0000-4000-8000-000000000001";

function purchase(statuses: Array<"ISSUED" | "PENDING_MINT">): PurchaseToNotify {
  return {
    id: purchaseId,
    tickets: statuses.map((status) => ({ status })),
    event: { name: "Show <Ao Vivo>", startsAt: new Date("2026-11-20T23:00:00.000Z") },
    ticketType: { name: "Pista" },
    buyer: { id: "user-1", email: "buyer@example.com" },
  } as unknown as PurchaseToNotify;
}

function notification(status: EmailNotificationRecord["status"]): EmailNotificationRecord {
  return { id: "notification-1", status } as EmailNotificationRecord;
}

describe("NotifyService", () => {
  let repository: jest.Mocked<
    Pick<
      NotificationsRepository,
      "purchaseOfTicket" | "claimTicketsReady" | "markSent" | "markFailed"
    >
  >;
  let email: jest.Mocked<EmailGateway>;
  let service: NotifyService;

  beforeEach(() => {
    repository = {
      purchaseOfTicket: jest.fn().mockResolvedValue(purchase(["ISSUED", "ISSUED"])),
      claimTicketsReady: jest.fn().mockResolvedValue(notification("PENDING")),
      markSent: jest.fn().mockResolvedValue(notification("SENT")),
      markFailed: jest.fn().mockResolvedValue(notification("FAILED")),
    };
    email = { send: jest.fn().mockResolvedValue({ id: "email-1" }) };
    service = new NotifyService(repository as unknown as NotificationsRepository, email, {
      appPublicUrl: "https://app.example.com",
    });
  });

  it("sends one e-mail per purchase, keyed by the purchase", async () => {
    await expect(service.ticketsReady("ticket-1")).resolves.toBe("sent");

    expect(repository.claimTicketsReady).toHaveBeenCalledWith(purchaseId, "user-1");
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "buyer@example.com" }),
      `tickets-ready:${purchaseId}`,
    );
    expect(repository.markSent).toHaveBeenCalledWith("notification-1", "email-1");
  });

  it("leaves the e-mail to the last ticket while one is still pending", async () => {
    repository.purchaseOfTicket.mockResolvedValue(purchase(["ISSUED", "PENDING_MINT"]));

    await expect(service.ticketsReady("ticket-1")).resolves.toBe("tickets_pending");
    expect(repository.claimTicketsReady).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it("does not send again once the purchase was notified or failed", async () => {
    repository.claimTicketsReady.mockResolvedValueOnce(notification("SENT"));
    await expect(service.ticketsReady("ticket-1")).resolves.toBe("already_sent");

    repository.claimTicketsReady.mockResolvedValueOnce(notification("FAILED"));
    await expect(service.ticketsReady("ticket-1")).resolves.toBe("already_failed");
    expect(email.send).not.toHaveBeenCalled();
  });

  it("records a rejected e-mail and stops retrying", async () => {
    email.send.mockRejectedValue(new EmailProviderError(false, "http_422:validation_error"));

    await expect(service.ticketsReady("ticket-1")).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repository.markFailed).toHaveBeenCalledWith(
      "notification-1",
      "http_422:validation_error",
    );
  });

  it("lets a transient provider failure retry with the record still pending", async () => {
    email.send.mockRejectedValue(new EmailProviderError(true, "http_503"));

    await expect(service.ticketsReady("ticket-1")).rejects.toBeInstanceOf(EmailProviderError);
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.markSent).not.toHaveBeenCalled();
  });

  it("fails without retry for an unknown ticket", async () => {
    repository.purchaseOfTicket.mockResolvedValue(null);
    await expect(service.ticketsReady("ticket-1")).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

describe("ticketsReadyEmail", () => {
  const message = ticketsReadyEmail({
    to: "buyer@example.com",
    eventName: "Show <Ao Vivo>",
    eventStartsAt: new Date("2026-11-20T23:00:00.000Z"),
    ticketTypeName: "Pista",
    quantity: 2,
    appPublicUrl: "https://app.example.com",
  });

  it("links to the buyer area with the event in São Paulo time", () => {
    expect(message.subject).toBe("Seus ingressos para Show <Ao Vivo> estão prontos");
    expect(message.text).toContain("2 ingressos · Pista");
    expect(message.text).toContain("20:00");
    expect(message.text).toContain("https://app.example.com/me/tickets");
    expect(message.html).toContain('href="https://app.example.com/me/tickets"');
  });

  it("escapes HTML and carries no QR token nor amounts", () => {
    expect(message.html).toContain("Show &lt;Ao Vivo&gt;");
    expect(message.html).not.toContain("<Ao Vivo>");
    for (const body of [message.html, message.text]) {
      expect(body).not.toMatch(/AT1\.|R\$|\d+,\d{2}/);
    }
  });
});
