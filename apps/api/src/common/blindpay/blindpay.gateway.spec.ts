import { BlindPayHttpGateway } from "./blindpay.gateway";
import { BlindPayProviderError } from "./blindpay.types";

const gateway = new BlindPayHttpGateway({
  apiKey: "blindpay-test-key",
  instanceId: "in_test",
  baseUrl: "https://api.blindpay.com/v1",
  timeoutMs: 500,
});

describe("BlindPayHttpGateway", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the initial KYC status from customer creation", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "re_test", kyc_status: "approved" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(gateway.createCustomer({ type: "individual" }, "idempotency-key")).resolves.toEqual(
      {
        id: "re_test",
        kycStatus: "approved",
      },
    );
  });

  it("rejects an unknown initial KYC status", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "re_test", kyc_status: "unknown" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).rejects.toBeInstanceOf(BlindPayProviderError);
  });
});
