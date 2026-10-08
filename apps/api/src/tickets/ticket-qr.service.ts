import { createHmac, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { TICKETS_CONFIG, type TicketsConfig } from "./tickets.types";

const tokenPattern = /^AT1\.([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/;

export interface ParsedTicketQr {
  ticketId: string;
  signature: Buffer;
}

/**
 * Signs the ticket QR token (SPEC-008 §6). The signature covers the ticket and its current owner,
 * so a change of owner invalidates the previous token without extra state.
 */
@Injectable()
export class TicketQrService {
  private readonly key: Buffer;

  constructor(@Inject(TICKETS_CONFIG) config: Pick<TicketsConfig, "qrSecret">) {
    this.key = Buffer.from(config.qrSecret, "base64url");
  }

  sign(ticketId: string, ownerUserId: string): string {
    const signature = this.mac(ticketId, ownerUserId).toString("base64url");
    return `AT1.${ticketId.replaceAll("-", "")}.${signature}`;
  }

  parse(token: string): ParsedTicketQr | null {
    const match = tokenPattern.exec(token);
    if (match === null) {
      return null;
    }
    const hex = match[1]!;
    const ticketId = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
    const signature = Buffer.from(match[2]!, "base64url");
    // The last character carries padding bits that decoding ignores; only the spelling `sign`
    // produces is accepted, so each ticket has a single valid token.
    if (signature.toString("base64url") !== match[2]) {
      return null;
    }
    return { ticketId, signature };
  }

  verify(token: string, ownerUserId: string): boolean {
    const parsed = this.parse(token);
    if (parsed === null) {
      return false;
    }
    const expected = this.mac(parsed.ticketId, ownerUserId);
    return (
      parsed.signature.length === expected.length && timingSafeEqual(parsed.signature, expected)
    );
  }

  private mac(ticketId: string, ownerUserId: string): Buffer {
    return createHmac("sha256", this.key)
      .update(`access-ticket-qr:v1:${ticketId.toLowerCase()}:${ownerUserId.toLowerCase()}`)
      .digest();
  }
}
