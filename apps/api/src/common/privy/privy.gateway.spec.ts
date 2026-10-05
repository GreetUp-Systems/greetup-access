import { Logger } from "@nestjs/common";

import { describePrivyError, PrivySdkGateway } from "./privy.gateway";
import { PrivyProviderUnavailableError } from "./privy.types";

const rawSign = jest.fn();

// A token-shaped value built at runtime, so the source carries nothing that looks like a secret.
const fakeJwt = ["eyJhbGciOiJFUzI1NiJ9", "eyJzdWIiOiJ1c2VyIn0", "c2lnbmF0dXJl"].join(".");
const hash = "a".repeat(64);

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
    .mockResolvedValue({ wallets: () => ({ rawSign }) });

  beforeEach(() => {
    rawSign.mockReset();
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it("keeps the operation as the error and logs Privy's answer", async () => {
    rawSign.mockRejectedValue(new Error("400 Invalid JWT token provided"));

    const error = await gateway
      .rawSignStellarHash("wallet", hash, fakeJwt, "key-1")
      .catch((e) => e);

    expect(error).toBeInstanceOf(PrivyProviderUnavailableError);
    expect(error).toMatchObject({ operation: "raw_sign_stellar" });
    expect(warn).toHaveBeenCalledWith(
      "Privy raw_sign_stellar failed: 400 Invalid JWT token provided",
    );
  });

  it("never logs the user's token", async () => {
    rawSign.mockRejectedValue(new Error(`401 Token ${fakeJwt} is expired`));

    await gateway.rawSignStellarHash("wallet", hash, fakeJwt, "key-1").catch(() => undefined);

    const logged = String(warn.mock.calls[0]?.[0]);
    expect(logged).toBe("Privy raw_sign_stellar failed: 401 Token [jwt] is expired");
    expect(logged).not.toContain(fakeJwt);
  });

  it("does not log its own input checks", async () => {
    await expect(
      gateway.rawSignStellarHash("wallet", "not-a-hash", fakeJwt, "key-1"),
    ).rejects.toThrow("raw_sign_invalid_input");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("describePrivyError", () => {
  it("words a thrown non-error and caps the length", () => {
    expect(describePrivyError("boom")).toBe("non-error thrown");
    expect(describePrivyError(new Error("x".repeat(500)))).toHaveLength(300);
  });
});
