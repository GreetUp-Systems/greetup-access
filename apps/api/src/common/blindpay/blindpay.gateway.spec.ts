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

    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).resolves.toEqual({
      id: "re_test",
      kycStatus: "approved",
    });
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

  it("registers a Stellar Testnet wallet by direct address", async () => {
    const address = `G${"A".repeat(55)}`;
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "bw_test", address, network: "stellar_testnet" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      gateway.registerExternalStellarWallet(
        { customerId: "re_test", address, name: "Access Stellar wallet" },
        "idempotency-key",
      ),
    ).resolves.toEqual({ id: "bw_test", address, network: "stellar_testnet" });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(request?.method).toBe("POST");
    expect(request?.body).toBe(
      JSON.stringify({
        name: "Access Stellar wallet",
        network: "stellar_testnet",
        is_account_abstraction: true,
        address,
      }),
    );
  });

  it("creates a Pix payin quote with buyer-covered fees and no payer rules", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "qu_test",
          expires_at: 1_790_000_000_000,
          sender_amount: 16_980,
          receiver_amount: 2_950,
          commercial_quotation: 5.42,
          blindpay_quotation: 5.5,
          flat_fee: 0,
          partner_fee_amount: 120,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      gateway.createPayinQuote(
        {
          blockchainWalletId: "bw_producer",
          requestAmountCents: 16_000,
          token: "USDB",
          partnerFeeId: "pf_access",
        },
        "quote-key",
      ),
    ).resolves.toEqual({
      id: "qu_test",
      expiresAt: new Date(1_790_000_000_000),
      senderAmount: 16_980,
      receiverAmount: 2_950,
      commercialQuotation: 5.42,
      blindpayQuotation: 5.5,
      flatFee: 0,
      partnerFeeAmount: 120,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.blindpay.com/v1/instances/in_test/payin-quotes");
    expect(JSON.parse(init!.body as string)).toEqual({
      blockchain_wallet_id: "bw_producer",
      currency_type: "sender",
      cover_fees: true,
      request_amount: 16_000,
      payment_method: "pix",
      token: "USDB",
      partner_fee_id: "pf_access",
    });
    expect(new Headers(init!.headers).get("Idempotency-Key")).toBe("quote-key");
  });

  it("omits the partner fee when none is configured and rejects incomplete quotes", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "qu_test", sender_amount: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      gateway.createPayinQuote(
        {
          blockchainWalletId: "bw_producer",
          requestAmountCents: 1_000,
          token: "USDB",
          partnerFeeId: undefined,
        },
        "quote-key",
      ),
    ).rejects.toMatchObject({ operation: "create_payin_quote_invalid_response" });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).not.toHaveProperty(
      "partner_fee_id",
    );
  });

  it("creates a payin and requires a Pix code", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "pi_test", status: "processing", pix_code: "00020126pix" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(gateway.createPayin("qu_test", "payin-key")).resolves.toEqual({
      id: "pi_test",
      status: "processing",
      pixCode: "00020126pix",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.blindpay.com/v1/instances/in_test/payins/evm");
    expect(JSON.parse(init!.body as string)).toEqual({ payin_quote_id: "qu_test" });

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "pi_test", status: "processing", pix_code: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(gateway.createPayin("qu_test", "payin-key")).rejects.toBeInstanceOf(
      BlindPayProviderError,
    );
  });

  it("marks provider 5xx and 429 as retryable and 4xx as final", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(gateway.createPayin("qu_test", "payin-key")).rejects.toMatchObject({
      retryable: true,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "PAYIN_QUOTE_EXPIRED" }), { status: 400 }),
    );
    await expect(gateway.createPayin("qu_test", "payin-key")).rejects.toMatchObject({
      retryable: false,
      providerCode: "PAYIN_QUOTE_EXPIRED",
    });
  });
});
