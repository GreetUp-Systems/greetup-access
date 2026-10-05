import { ApiError } from "./api/client";
import { restoreSession } from "./session-restore";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const account = {
  user: { id: "user-1", email: "comprador@example.com" },
  wallet: { address: "GABC", chainType: "stellar" },
};

describe("restoreSession", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  const signOut = jest.fn<Promise<void>, []>();
  const getToken = (): Promise<string> => Promise.resolve("tok");

  beforeEach(() => {
    fetchMock.mockReset();
    signOut.mockReset().mockResolvedValue(undefined);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("returns the account of the existing session", async () => {
    fetchMock.mockResolvedValue(respond(200, account));

    await expect(restoreSession(getToken, signOut)).resolves.toEqual(account);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("http://api.test/api/me");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("finishes a bootstrap that never finished, as a checkout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(404, { code: "account_not_bootstrapped", message: "Not bootstrapped." }),
      )
      .mockResolvedValueOnce(respond(200, account));

    await expect(restoreSession(getToken, signOut)).resolves.toEqual(account);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe("http://api.test/api/auth/bootstrap");
    expect(init?.body).toBe(JSON.stringify({ origin: "checkout" }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it("closes the session when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(restoreSession(getToken, signOut)).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes the session when the API refuses it", async () => {
    fetchMock.mockResolvedValue(respond(401, { code: "unauthorized", message: "Invalid token." }));

    await expect(restoreSession(getToken, signOut)).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes the session when Privy has no token to give", async () => {
    const noToken = (): Promise<string> =>
      Promise.reject(new ApiError(401, "session_expired", "There is no active session.", null));

    await expect(restoreSession(noToken, signOut)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("still answers signed out when closing the session fails", async () => {
    fetchMock.mockResolvedValue(respond(500, { code: "internal_error", message: "Boom." }));
    signOut.mockRejectedValue(new Error("Privy is down"));

    await expect(restoreSession(getToken, signOut)).resolves.toBeNull();
  });
});
