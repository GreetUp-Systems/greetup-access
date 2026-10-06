import { Logger } from "@nestjs/common";

import { describePrivyError, PrivySdkGateway } from "./privy.gateway";
import { PrivyProviderUnavailableError } from "./privy.types";

const create = jest.fn();

// A token-shaped value built at runtime, so the source carries nothing that looks like a secret.
const fakeJwt = ["eyJhbGciOiJFUzI1NiJ9", "eyJzdWIiOiJ1c2VyIn0", "c2lnbmF0dXJl"].join(".");

describe("PrivySdkGateway errors", () => {
  const gateway = new PrivySdkGateway({
    appId: "app",
    appSecret: "secret",
    jwtVerificationKey: "key",
    timeoutMs: 1_000,
  });
  let warn: jest.SpyInstance;

  // The SDK is loaded by a native dynamic import, which jest cannot mock: the client is replaced.
  jest
    .spyOn(gateway as unknown as { getClient: () => Promise<unknown> }, "getClient")
    .mockResolvedValue({ wallets: () => ({ create }) });

  beforeEach(() => {
    create.mockReset();
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it("keeps the operation as the error and logs Privy's answer", async () => {
    create.mockRejectedValue(new Error("400 Invalid owner provided"));

    const error = await gateway.createStellarWallet("did:privy:user", "key-1").catch((e) => e);

    expect(error).toBeInstanceOf(PrivyProviderUnavailableError);
    expect(error).toMatchObject({ operation: "create_stellar_wallet" });
    expect(warn).toHaveBeenCalledWith(
      "Privy create_stellar_wallet failed: 400 Invalid owner provided",
    );
  });

  it("never logs a token", async () => {
    create.mockRejectedValue(new Error(`401 Token ${fakeJwt} is expired`));

    await gateway.createStellarWallet("did:privy:user", "key-1").catch(() => undefined);

    const logged = String(warn.mock.calls[0]?.[0]);
    expect(logged).toBe("Privy create_stellar_wallet failed: 401 Token [jwt] is expired");
    expect(logged).not.toContain(fakeJwt);
  });

  it("does not log its own response checks", async () => {
    create.mockResolvedValue({ id: "w", address: "not-stellar", chain_type: "stellar" });

    await expect(gateway.createStellarWallet("did:privy:user", "key-1")).rejects.toThrow(
      "stellar_wallet_invalid_response",
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("describePrivyError", () => {
  it("words a thrown non-error and caps the length", () => {
    expect(describePrivyError("boom")).toBe("non-error thrown");
    expect(describePrivyError(new Error("x".repeat(500)))).toHaveLength(300);
  });
});
