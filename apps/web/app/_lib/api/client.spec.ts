import { apiRequest, ApiError } from "./client";

function respond(status: number, body: unknown): Response {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiRequest", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends the bearer token and the JSON body to the API URL", async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }));

    await expect(
      apiRequest("/auth/bootstrap", { method: "POST", token: "tok", body: { origin: "login" } }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/auth/bootstrap");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
    });
    expect(init?.body).toBe(JSON.stringify({ origin: "login" }));
  });

  it("turns an error response into an ApiError carrying the API code", async () => {
    fetchMock.mockResolvedValue(
      respond(409, { code: "purchase_total_changed", message: "The total changed." }),
    );

    const error = await apiRequest("/purchases/1/pix", { method: "POST" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "purchase_total_changed" });
  });

  it("falls back to http_<status> when the body has no code", async () => {
    fetchMock.mockResolvedValue(new Response("Bad gateway", { status: 502 }));

    await expect(apiRequest("/me")).rejects.toMatchObject({ status: 502, code: "http_502" });
  });

  it("reports a request that never got an answer as network_error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiRequest("/me")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});
