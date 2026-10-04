import { randomBytes, randomUUID } from "node:crypto";

import { TicketQrService } from "./ticket-qr.service";

function service(): TicketQrService {
  return new TicketQrService({ qrSecret: randomBytes(32).toString("base64url") });
}

describe("TicketQrService", () => {
  const ticketId = randomUUID();
  const ownerUserId = randomUUID();

  it("signs a compact token that verifies for the current owner", () => {
    const qr = service();
    const token = qr.sign(ticketId, ownerUserId);

    expect(token).toMatch(/^AT1\.[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/);
    expect(qr.parse(token)?.ticketId).toBe(ticketId);
    expect(qr.verify(token, ownerUserId)).toBe(true);
  });

  it("rejects the token of a previous owner", () => {
    const qr = service();
    expect(qr.verify(qr.sign(ticketId, ownerUserId), randomUUID())).toBe(false);
  });

  it("rejects a tampered token and one signed with another secret", () => {
    const qr = service();
    const token = qr.sign(ticketId, ownerUserId);
    const otherTicket = token.replace(/^AT1\.[0-9a-f]{32}/, `AT1.${"0".repeat(32)}`);
    const lastChar = token.at(-1) === "A" ? "B" : "A";

    expect(qr.verify(otherTicket, ownerUserId)).toBe(false);
    expect(qr.verify(`${token.slice(0, -1)}${lastChar}`, ownerUserId)).toBe(false);
    expect(service().verify(token, ownerUserId)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    const qr = service();
    for (const token of ["", "AT1..", `AT2.${"0".repeat(32)}.${"A".repeat(43)}`, "garbage"]) {
      expect(qr.parse(token)).toBeNull();
      expect(qr.verify(token, ownerUserId)).toBe(false);
    }
  });
});
