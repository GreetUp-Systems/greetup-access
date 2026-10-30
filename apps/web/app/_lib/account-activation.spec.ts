import {
  accountActivationRoutes,
  activateAndConfirm,
  activateStellar,
  ActivationUnconfirmedError,
  type ActivationRoutes,
  producerActivationRoutes,
  signatureRequired,
  SignatureRequiredError,
  type SignStellarHash,
  type StellarActivationView,
} from "./account-activation";
import { ApiError } from "./api/client";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const hash = "a".repeat(64);
const signature = `0x${"b".repeat(128)}` as const;
const getToken = (): Promise<string> => Promise.resolve("tok");

describe("activateStellar", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  const signHash = jest.fn<ReturnType<SignStellarHash>, Parameters<SignStellarHash>>();

  beforeEach(() => {
    fetchMock.mockReset();
    signHash.mockReset().mockResolvedValue(signature);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("signs the prepared hash in the browser and sends the signature", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(200, { status: "active", transactionHash: hash }));

    await expect(activateStellar(accountActivationRoutes, getToken, signHash)).resolves.toEqual({
      status: "active",
      transactionHash: hash,
    });
    expect(signHash).toHaveBeenCalledWith(`0x${hash}`);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("http://api.test/api/me/stellar/activate");
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe("http://api.test/api/me/stellar/activate/signature");
    expect(init?.body).toBe(JSON.stringify({ hash, signature }));
  });

  it("uses the producer's routes for the receiving account", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(200, { status: "submitted", transactionHash: hash }));

    await activateStellar(producerActivationRoutes, getToken, signHash);

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["http://api.test/api/producers/onboarding/stellar/activate", "POST"],
      ["http://api.test/api/producers/onboarding/stellar/activate/signature", "POST"],
    ]);
  });

  it("asks nothing of the wallet when the account needs no transaction", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { status: "active", transactionHash: null }));

    await expect(
      activateStellar(accountActivationRoutes, getToken, signHash),
    ).resolves.toMatchObject({ status: "active" });
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

    await expect(
      activateStellar(accountActivationRoutes, getToken, signHash),
    ).resolves.toMatchObject({ status: "submitted" });
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

    await expect(
      activateStellar(accountActivationRoutes, getToken, signHash),
    ).rejects.toMatchObject({ code: "activation_signature_stale" });
    expect(signHash).toHaveBeenCalledTimes(2);
  });

  it("does not retry other failures, nor a refused signature", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(422, { code: "invalid_activation_signature", message: "" }));
    await expect(
      activateStellar(accountActivationRoutes, getToken, signHash),
    ).rejects.toBeInstanceOf(ApiError);

    signHash.mockRejectedValueOnce(new Error("user closed Privy"));
    fetchMock.mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }));
    await expect(activateStellar(accountActivationRoutes, getToken, signHash)).rejects.toThrow(
      "user closed Privy",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

/** Routes answering from a script: one view (or error) per call, in order. */
function scriptedRoutes(
  prepared: Array<StellarActivationView | Error>,
  submitted: StellarActivationView,
) {
  const prepare = jest.fn(async () => {
    const next = prepared.shift();
    if (next === undefined) {
      throw new Error("no more prepare answers");
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
  const submitSignature = jest.fn(async () => submitted);
  const routes: ActivationRoutes = { prepare, submitSignature };
  return { routes, prepare, submitSignature };
}

describe("activateAndConfirm", () => {
  const signHash = jest.fn<ReturnType<SignStellarHash>, Parameters<SignStellarHash>>();
  const wait = jest.fn<Promise<void>, [number]>(() => Promise.resolve());

  beforeEach(() => {
    signHash.mockReset().mockResolvedValue(signature);
    wait.mockClear();
  });

  it("is done when the signature lands the account at once", async () => {
    const { routes, prepare } = scriptedRoutes([{ status: "signing", hashToSign: hash }], {
      status: "active",
      transactionHash: hash,
    });

    await expect(activateAndConfirm(routes, getToken, signHash, { wait })).resolves.toEqual({
      status: "active",
      transactionHash: hash,
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("reads a submitted activation again, a ledger apart, until the network confirms it", async () => {
    const { routes, prepare } = scriptedRoutes(
      [
        { status: "signing", hashToSign: hash },
        { status: "submitted", transactionHash: hash },
        { status: "active", transactionHash: hash },
      ],
      { status: "submitted", transactionHash: hash },
    );

    await expect(
      activateAndConfirm(routes, getToken, signHash, { wait, intervalMs: 5_000 }),
    ).resolves.toEqual({ status: "active", transactionHash: hash });
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[5_000], [5_000]]);
    expect(signHash).toHaveBeenCalledTimes(1);
  });

  it("stops, unconfirmed, when the reads run out", async () => {
    const { routes, prepare } = scriptedRoutes(
      [
        { status: "signing", hashToSign: hash },
        { status: "submitted", transactionHash: hash },
        { status: "submitted", transactionHash: hash },
      ],
      { status: "submitted", transactionHash: hash },
    );

    const error: unknown = await activateAndConfirm(routes, getToken, signHash, {
      wait,
      reads: 2,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ActivationUnconfirmedError);
    expect((error as ActivationUnconfirmedError).last).toEqual({
      status: "submitted",
      transactionHash: hash,
    });
    expect(prepare).toHaveBeenCalledTimes(3);
  });

  it("never signs again while waiting: a new transaction to sign ends the wait", async () => {
    const fresh = "c".repeat(64);
    const { routes, submitSignature } = scriptedRoutes(
      [
        { status: "signing", hashToSign: hash },
        { status: "signing", hashToSign: fresh },
      ],
      { status: "submitted", transactionHash: hash },
    );

    const error: unknown = await activateAndConfirm(routes, getToken, signHash, { wait }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ActivationUnconfirmedError);
    expect((error as ActivationUnconfirmedError).last).toEqual({
      status: "signing",
      hashToSign: fresh,
    });
    expect(signHash).toHaveBeenCalledTimes(1);
    expect(submitSignature).toHaveBeenCalledTimes(1);
  });

  it("passes on a failure of a read", async () => {
    const failure = new ApiError(502, "stellar_activation_failed", "", null);
    const { routes } = scriptedRoutes([{ status: "signing", hashToSign: hash }, failure], {
      status: "submitted",
      transactionHash: hash,
    });

    await expect(activateAndConfirm(routes, getToken, signHash, { wait })).rejects.toBe(failure);
  });

  it("resumes without the wallet (R6): a transaction to sign ends the run unsigned", async () => {
    const { routes, submitSignature } = scriptedRoutes([{ status: "signing", hashToSign: hash }], {
      status: "submitted",
      transactionHash: hash,
    });

    await expect(
      activateAndConfirm(routes, getToken, signatureRequired, { wait }),
    ).rejects.toBeInstanceOf(SignatureRequiredError);
    expect(submitSignature).not.toHaveBeenCalled();
  });

  it("resumes without the wallet what needs no signature: follows a submitted one", async () => {
    const { routes } = scriptedRoutes(
      [
        { status: "submitted", transactionHash: hash },
        { status: "active", transactionHash: hash },
      ],
      { status: "submitted", transactionHash: hash },
    );

    await expect(
      activateAndConfirm(routes, getToken, signatureRequired, { wait }),
    ).resolves.toEqual({ status: "active", transactionHash: hash });
  });
});
