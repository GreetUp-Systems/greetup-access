import { BlindPayHttpGateway } from "./blindpay.gateway";
import { BlindPayAmountOutOfRangeError, BlindPayProviderError } from "./blindpay.types";

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

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("accepts the customer creation response that carries only ids", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(json({ id: "re_test", customer_id: "re_test" }));

    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).resolves.toEqual({ id: "re_test" });
  });

  it("reads the customer KYC status and rejects an unknown one as uncertain", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(json({ id: "re_test", kyc_status: "approved" }))
      .mockResolvedValueOnce(json({ id: "re_test", kyc_status: "unknown" }));

    await expect(gateway.getCustomerKycStatus("re_test")).resolves.toBe("approved");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://api.blindpay.com/v1/instances/in_test/customers/re_test",
    );
    await expect(gateway.getCustomerKycStatus("re_test")).rejects.toMatchObject({
      operation: "get_customer_invalid_response",
      retryable: true,
    });
  });

  it("reads the current attempt: open KYC warnings and the text fields, never files or fraud signals", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      json({
        id: "re_test",
        type: "individual",
        kyc_type: "standard",
        kyc_status: "rejected",
        first_name: "Maria",
        last_name: "Silva",
        date_of_birth: "1990-05-17T00:00:00.000Z",
        tax_id: "12345678909",
        phone_number: "+5511999999999",
        address_line_1: "Rua Augusta, 100",
        address_line_2: null,
        city: "São Paulo",
        state_province_region: "SP",
        postal_code: "01304-000",
        country: "BR",
        id_doc_country: "BR",
        id_doc_type: "ID_CARD",
        id_doc_front_file: "https://files.blindpay.test/front.png",
        id_doc_back_file: "https://files.blindpay.test/back.png",
        selfie_file: "https://files.blindpay.test/selfie.png",
        proof_of_address_doc_file: "https://files.blindpay.test/address.pdf",
        kyc_warnings: [
          {
            code: "BIRTH_DATE_MISMATCH",
            message: "Mismatch between supplied birth date and extracted birth date.",
            resolution_status: "UNRESOLVED",
            warning_id: "w1",
          },
          { code: "FACE_MISMATCH", message: "Face mismatch.", resolution_status: "RESOLVED" },
          { code: null, message: "Without a code." },
        ],
        fraud_warnings: [{ id: "UC114", name: "Datacenter proxy", operation: "+", score: 10 }],
      }),
    );

    const attempt = await gateway.getCustomerAttempt("re_test");

    expect(attempt).toEqual({
      status: "rejected",
      warnings: [
        {
          code: "BIRTH_DATE_MISMATCH",
          message: "Mismatch between supplied birth date and extracted birth date.",
        },
      ],
      draft: {
        firstName: "Maria",
        lastName: "Silva",
        dateOfBirth: "1990-05-17",
        taxId: "12345678909",
        phoneNumber: "+5511999999999",
        addressLine1: "Rua Augusta, 100",
        addressLine2: null,
        city: "São Paulo",
        stateProvinceRegion: "SP",
        postalCode: "01304-000",
        country: "BR",
        idDocCountry: "BR",
        idDocType: "ID_CARD",
      },
    });
    expect(JSON.stringify(attempt)).not.toMatch(/files\.blindpay|UC114|proxy/);
  });

  it("reads an attempt without warnings and refuses an unknown status", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        json({ id: "re_test", kyc_status: "pending_review", kyc_warnings: null }),
      )
      .mockResolvedValueOnce(json({ id: "re_test", kyc_status: "mystery" }));

    await expect(gateway.getCustomerAttempt("re_test")).resolves.toMatchObject({
      status: "pending_review",
      warnings: [],
      draft: { firstName: null, dateOfBirth: null, idDocType: null },
    });
    await expect(gateway.getCustomerAttempt("re_test")).rejects.toMatchObject({
      operation: "get_customer_invalid_response",
      retryable: true,
    });
  });

  it("treats an unexpected success response as an uncertain outcome", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(json({ customer_id: "re_test" }))
      .mockResolvedValueOnce(new Response("<html>ok</html>", { status: 200 }));

    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).rejects.toMatchObject({ operation: "create_customer_invalid_response", retryable: true });
    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).rejects.toMatchObject({ operation: "create_customer_invalid_response", retryable: true });
  });

  it("keeps an explicit rejection final, with or without a JSON body", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(json({ success: false, code: "CUSTOMERS_INVALID_TAX_ID" }, 400))
      .mockResolvedValueOnce(new Response("<html>Bad Request</html>", { status: 400 }));

    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).rejects.toMatchObject({
      operation: "create_customer",
      retryable: false,
      statusCode: 400,
      providerCode: "CUSTOMERS_INVALID_TAX_ID",
    });
    await expect(
      gateway.createCustomer({ type: "individual" }, "idempotency-key"),
    ).rejects.toMatchObject({ operation: "create_customer", retryable: false, statusCode: 400 });
  });

  it("registers a Stellar Testnet wallet by direct address", async () => {
    const address = `G${"A".repeat(55)}`;
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
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

  it.each([
    ["The amount in USD is $2.1. It should be between $10 and $10000", "below_minimum"],
    ["The amount in USD is $199756.64. It should be between $10 and $10000", "above_maximum"],
  ])(
    "reads the Pix range refusal %#, which BlindPay sends without a code",
    async (message, direction) => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false, message, errors: [] }), { status: 400 }),
        );

      const error: unknown = await gateway
        .createPayinQuote(
          {
            blockchainWalletId: "bw_producer",
            requestAmountCents: 1_000,
            token: "USDB",
            partnerFeeId: undefined,
          },
          "quote-key",
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BlindPayAmountOutOfRangeError);
      expect(error).toMatchObject({ direction, retryable: false, operation: "create_payin_quote" });
    },
  );

  it("keeps any other 400 as a plain provider rejection", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: "One or more params are not valid",
          errors: [],
        }),
        { status: 400 },
      ),
    );

    const error: unknown = await gateway
      .createPayinQuote(
        {
          blockchainWalletId: "bw_producer",
          requestAmountCents: 6_000,
          token: "USDB",
          partnerFeeId: undefined,
        },
        "quote-key",
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BlindPayProviderError);
    expect(error).not.toBeInstanceOf(BlindPayAmountOutOfRangeError);
    expect(error).toMatchObject({ retryable: false, statusCode: 400 });
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
