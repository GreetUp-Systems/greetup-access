import { createHmac } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";

import { BlindPayWebhookVerifier } from "./blindpay-webhook.verifier";

const secretBytes = Buffer.from("blindpay-webhook-test-secret", "utf8");
const secret = `whsec_${secretBytes.toString("base64")}`;
const now = 1_800_000_000;
const messageId = "msg_test_01";
const payload = Buffer.from('{"webhook_event":"customer.update","id":"re_test"}', "utf8");

function signature(body: Buffer, timestamp = now): string {
  return createHmac("sha256", secretBytes)
    .update(Buffer.concat([Buffer.from(`${messageId}.${timestamp}.`, "utf8"), body]))
    .digest("base64");
}

describe("BlindPayWebhookVerifier", () => {
  const verifier = new BlindPayWebhookVerifier();

  it("accepts the exact raw body and any matching v1 signature", () => {
    const result = verifier.verify(
      secret,
      payload,
      {
        messageId,
        timestamp: String(now),
        signature: `v1,${Buffer.alloc(32).toString("base64")} v1,${signature(payload)}`,
      },
      now,
    );

    expect(result).toEqual({
      messageId,
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects a tampered raw body", () => {
    expect(() =>
      verifier.verify(
        secret,
        Buffer.from(`${payload.toString("utf8")} `, "utf8"),
        {
          messageId,
          timestamp: String(now),
          signature: `v1,${signature(payload)}`,
        },
        now,
      ),
    ).toThrow(UnauthorizedException);
  });

  it("rejects expired and future signatures", () => {
    for (const timestamp of [now - 301, now + 301]) {
      expect(() =>
        verifier.verify(
          secret,
          payload,
          {
            messageId,
            timestamp: String(timestamp),
            signature: `v1,${signature(payload, timestamp)}`,
          },
          now,
        ),
      ).toThrow(UnauthorizedException);
    }
  });

  it("rejects malformed headers and signatures", () => {
    expect(() =>
      verifier.verify(
        secret,
        payload,
        {
          messageId,
          timestamp: String(now),
          signature: "v2,not-supported malformed",
        },
        now,
      ),
    ).toThrow(UnauthorizedException);
  });
});
