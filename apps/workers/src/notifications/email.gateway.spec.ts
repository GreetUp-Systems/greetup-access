import { EmailProviderError, ResendEmailGateway } from "./email.gateway";

const gateway = new ResendEmailGateway({ apiKey: "re_test", from: "Access <a@example.com>" });
const message = { to: "buyer@example.com", subject: "s", html: "<p>h</p>", text: "t" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ResendEmailGateway", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends with the idempotency key and returns the provider id", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(json({ id: "email-1" }));

    await expect(gateway.send(message, "tickets-ready:p1")).resolves.toEqual({ id: "email-1" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init!.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("tickets-ready:p1");
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init!.body as string)).toEqual({
      from: "Access <a@example.com>",
      ...message,
    });
  });

  it("retries rate limits, server errors, network failures and unreadable successes", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(json({ name: "rate_limit_exceeded" }, 429))
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    for (const code of [
      "http_429:rate_limit_exceeded",
      "http_503",
      "network",
      "invalid_response",
    ]) {
      await expect(gateway.send(message, "key")).rejects.toMatchObject({ retryable: true, code });
    }
  });

  it("treats other client errors as final", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(json({ name: "validation_error" }, 422));

    const error = await gateway.send(message, "key").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailProviderError);
    expect(error).toMatchObject({ retryable: false, code: "http_422:validation_error" });
  });
});
