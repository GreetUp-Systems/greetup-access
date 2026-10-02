import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";

export interface BlindPayWebhookHeaders {
  messageId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

export interface VerifiedBlindPayWebhook {
  messageId: string;
  payloadHash: string;
}

@Injectable()
export class BlindPayWebhookVerifier {
  verify(
    secret: string,
    rawBody: Buffer,
    headers: BlindPayWebhookHeaders,
    nowInSeconds = Math.floor(Date.now() / 1_000),
  ): VerifiedBlindPayWebhook {
    const { messageId, timestamp, signature } = headers;
    if (
      messageId === undefined ||
      messageId.length === 0 ||
      messageId.length > 255 ||
      timestamp === undefined ||
      signature === undefined
    ) {
      throw this.invalidSignature();
    }

    const timestampValue = Number(timestamp);
    if (!Number.isSafeInteger(timestampValue) || Math.abs(nowInSeconds - timestampValue) > 5 * 60) {
      throw this.invalidSignature();
    }

    const encodedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : "";
    const secretBytes = Buffer.from(encodedSecret, "base64");
    if (secretBytes.length === 0) {
      throw new BadRequestException({
        code: "webhook_configuration_invalid",
        message: "Webhook verification is not configured correctly.",
      });
    }

    const signedContent = Buffer.concat([
      Buffer.from(`${messageId}.${timestamp}.`, "utf8"),
      rawBody,
    ]);
    const expected = createHmac("sha256", secretBytes).update(signedContent).digest();
    const valid = signature.split(" ").some((candidate) => {
      const [version, encoded] = candidate.split(",", 2);
      if (version !== "v1" || encoded === undefined) {
        return false;
      }

      try {
        const actual = Buffer.from(encoded, "base64");
        return actual.length === expected.length && timingSafeEqual(actual, expected);
      } catch {
        return false;
      }
    });

    if (!valid) {
      throw this.invalidSignature();
    }

    return {
      messageId,
      payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    };
  }

  private invalidSignature(): UnauthorizedException {
    return new UnauthorizedException({
      code: "invalid_webhook_signature",
      message: "The webhook signature is invalid.",
    });
  }
}
