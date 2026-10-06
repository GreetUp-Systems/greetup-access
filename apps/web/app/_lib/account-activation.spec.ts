import { activateStellarAccount, type SignStellarHash } from "./account-activation";
import { ApiError } from "./api/client";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const hash = "a".repeat(64);
const signature = `0x${"b".repeat(128)}` as const;

describe("activateStellarAccount", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  const signHash = jest.fn<ReturnType<SignStellarHash>, Parameters<SignStellarHash>>();
  const getToken = (): Promise<string> => Promise.resolve("tok");

  beforeEach(() => {
    fetchMock.mockReset();
    signHash.mockReset().mockResolvedValue(signature);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("signs the prepared hash in the browser and sends the signature", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(200, { status: "active", transactionHash: hash }));

    await expect(activateStellarAccount(getToken, signHash)).resolves.toEqual({
      status: "active",
      transactionHash: hash,
    });
    expect(signHash).toHaveBeenCalledWith(`0x${hash}`);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe("http://api.test/api/me/stellar/activate/signature");
    expect(init?.body).toBe(JSON.stringify({ hash, signature }));
  });

  it("asks nothing of the wallet when the account needs no transaction", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { status: "active", transactionHash: null }));

    await expect(activateStellarAccount(getToken, signHash)).resolves.toMatchObject({
      status: "active",
    });
    expect(signHash).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prepares and signs once more when the prepared transaction went stale", async () => {
    const fresh = "c".repeat(64);
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(409, { code: "activation_signature_stale", message: "" }))
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: fresh }))
      .mockResolvedValueOnce(respond(200, { status: "submitted", transactionHash: fresh }));

    await expect(activateStellarAccount(getToken, signHash)).resolves.toMatchObject({
      status: "submitted",
    });
    expect(signHash.mock.calls).toEqual([[`0x${hash}`], [`0x${fresh}`]]);
  });

  it("gives up after a second stale answer", async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        String(url).endsWith("/signature")
          ? respond(409, { code: "activation_signature_stale", message: "" })
          : respond(200, { status: "signing", hashToSign: hash }),
      ),
    );

    await expect(activateStellarAccount(getToken, signHash)).rejects.toMatchObject({
      code: "activation_signature_stale",
    });
    expect(signHash).toHaveBeenCalledTimes(2);
  });

  it("does not retry other failures, nor a refused signature", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(422, { code: "invalid_activation_signature", message: "" }));
    await expect(activateStellarAccount(getToken, signHash)).rejects.toBeInstanceOf(ApiError);

    signHash.mockRejectedValueOnce(new Error("user closed Privy"));
    fetchMock.mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }));
    await expect(activateStellarAccount(getToken, signHash)).rejects.toThrow("user closed Privy");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
