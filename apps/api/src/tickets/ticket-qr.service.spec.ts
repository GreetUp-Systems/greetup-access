import { randomBytes, randomUUID } from "node:crypto";

import { TicketQrService } from "./ticket-qr.service";

const base64url = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function service(): TicketQrService {
  return new TicketQrService({ qrSecret: randomBytes(32).toString("base64url") });
}

/** Replaces the character at `index` of the token with the next one of the alphabet. */
function respell(token: string, index: number): string {
  const position = index < 0 ? token.length + index : index;
  const next = base64url[(base64url.indexOf(token[position]!) + 1) % base64url.length]!;
  return `${token.slice(0, position)}${next}${token.slice(position + 1)}`;
}

function signatureBytes(token: string): Buffer {
  return Buffer.from(token.split(".")[2]!, "base64url");
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
    // A character before the last one carries 6 bits of the signature: any change alters it.
    const tampered = respell(token, -2);

    expect(signatureBytes(tampered)).not.toEqual(signatureBytes(token));
    expect(qr.verify(otherTicket, ownerUserId)).toBe(false);
    expect(qr.verify(tampered, ownerUserId)).toBe(false);
    expect(service().verify(token, ownerUserId)).toBe(false);
  });

  it("accepts only the spelling of the signature that it signs", () => {
    const qr = service();
    const token = qr.sign(ticketId, ownerUserId);
    // The last character holds 4 bits of the signature and 2 padding bits. Signing leaves the
    // padding at zero, so the next character spells the same bytes with a padding bit set.
    const respelled = respell(token, -1);

    expect(signatureBytes(respelled)).toEqual(signatureBytes(token));
    expect(qr.parse(respelled)).toBeNull();
    expect(qr.verify(respelled, ownerUserId)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    const qr = service();
    for (const token of ["", "AT1..", `AT2.${"0".repeat(32)}.${"A".repeat(43)}`, "garbage"]) {
      expect(qr.parse(token)).toBeNull();
      expect(qr.verify(token, ownerUserId)).toBe(false);
    }
  });
});
