export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailGateway {
  /** The same idempotency key within 24 h never sends a second e-mail (Resend). */
  send(message: EmailMessage, idempotencyKey: string): Promise<{ id: string }>;
}

export const EMAIL_GATEWAY = Symbol("EMAIL_GATEWAY");

export class EmailProviderError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly code: string,
  ) {
    super(`E-mail provider failed: ${code}`);
    this.name = "EmailProviderError";
  }
}

const requestTimeoutMs = 10_000;

/** Sends through the Resend REST API; the body never reaches the logs. */
export class ResendEmailGateway implements EmailGateway {
  constructor(private readonly options: { apiKey: string; from: string; baseUrl?: string }) {}

  async send(message: EmailMessage, idempotencyKey: string): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl ?? "https://api.resend.com"}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ from: this.options.from, ...message }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new EmailProviderError(true, "network");
    }

    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      const name =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>).name
          : undefined;
      const code = `http_${response.status}${typeof name === "string" ? `:${name}` : ""}`;
      throw new EmailProviderError(response.status === 429 || response.status >= 500, code);
    }

    const id =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>).id
        : undefined;
    if (typeof id !== "string" || id.length === 0) {
      // Accepted but unreadable: retrying with the same key cannot send a duplicate.
      throw new EmailProviderError(true, "invalid_response");
    }
    return { id };
  }
}
