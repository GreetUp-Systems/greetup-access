import { ApiError } from "./client";
import {
  createCustomer,
  createProducer,
  createTermsSession,
  getCustomerAttempt,
  getOpenRfi,
  type IndividualCustomerInput,
  prepareProducerActivation,
  submitProducerActivationSignature,
  submitRfi,
  uploadOnboardingFile,
} from "./onboarding";

function respond(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const customer: IndividualCustomerInput = {
  type: "individual",
  kycType: "standard",
  tosId: "to_123",
  firstName: "Ana",
  lastName: "Souza",
  dateOfBirth: "1990-03-15T00:00:00.000Z",
  taxId: "12345678909",
  phoneNumber: "+5511912345678",
  addressLine1: "Rua Augusta, 1200",
  addressLine2: "Apto 42",
  city: "São Paulo",
  stateProvinceRegion: "SP",
  postalCode: "01310100",
  country: "BR",
  idDocCountry: "BR",
  idDocType: "ID_CARD",
  idDocFrontFile: "https://files.example/front.jpg",
  idDocBackFile: "https://files.example/back.jpg",
  selfieFile: "https://files.example/selfie.jpg",
};

describe("onboarding API", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  function request(index = 0): { url: string; init: RequestInit | undefined } {
    const [url, init] = fetchMock.mock.calls[index]!;
    return { url: String(url), init };
  }

  it("creates the producer profile with its public name", async () => {
    const profile = {
      id: "p1",
      displayName: "Casa Fluida",
      onboardingStatus: "stellar_pending",
      compliance: { status: null, hasOpenRfi: false },
      stellar: { status: "not_started" },
    };
    fetchMock.mockResolvedValue(respond(200, profile));

    await expect(createProducer("tok", "Casa Fluida")).resolves.toEqual(profile);
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(init?.body).toBe(JSON.stringify({ displayName: "Casa Fluida" }));
  });

  it("opens the terms with the address BlindPay comes back to", async () => {
    fetchMock.mockResolvedValue(respond(200, { url: "https://app.blindpay.com/tos/abc" }));

    await expect(
      createTermsSession("tok", "https://access.test/producer/receiving/data"),
    ).resolves.toEqual({ url: "https://app.blindpay.com/tos/abc" });
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers/onboarding/tos");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({ redirectUrl: "https://access.test/producer/receiving/data" }),
    );
  });

  it("uploads one file as the multipart field `file`, with the idempotency key", async () => {
    fetchMock.mockResolvedValue(respond(200, { fileUrl: "https://files.example/front.jpg" }));
    const file = new File(["jpeg bytes"], "rg-frente.jpg", { type: "image/jpeg" });

    await expect(uploadOnboardingFile("tok", file, "key-file")).resolves.toEqual({
      fileUrl: "https://files.example/front.jpg",
    });
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers/onboarding/files");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer tok",
      "Idempotency-Key": "key-file",
    });
    expect(init?.headers).not.toHaveProperty("Content-Type");
    const sent = (init?.body as FormData).get("file");
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("rg-frente.jpg");
    expect((sent as File).type).toBe("image/jpeg");
    expect(await (sent as File).text()).toBe("jpeg bytes");
  });

  it("creates the customer with the body and the key of the submission", async () => {
    const created = { id: "a1", customerId: "re_1", type: "individual", status: "verifying" };
    fetchMock.mockResolvedValue(respond(200, created));

    await expect(createCustomer("tok", customer, "key-customer")).resolves.toEqual(created);
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers/onboarding/customer");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": "key-customer",
    });
    expect(JSON.parse(String(init?.body))).toEqual(customer);
  });

  it("carries the API's code when the submission is refused", async () => {
    fetchMock.mockResolvedValue(
      respond(409, { code: "customer_attempt_already_active", message: "Active." }),
    );

    await expect(createCustomer("tok", customer, "key-customer")).rejects.toMatchObject({
      status: 409,
      code: "customer_attempt_already_active",
    });
  });

  it("reads the current attempt, with its reasons and data", async () => {
    const attempt = {
      status: "rejected",
      reasons: [{ code: "BIRTH_DATE_MISMATCH", message: "Mismatch between birth dates." }],
      draft: {
        firstName: "Ana",
        lastName: "Souza",
        dateOfBirth: "1990-03-15",
        taxId: "12345678909",
        phoneNumber: "+5511912345678",
        addressLine1: "Rua Augusta, 1200",
        addressLine2: null,
        city: "São Paulo",
        stateProvinceRegion: "SP",
        postalCode: "01310100",
        country: "BR",
        idDocCountry: "BR",
        idDocType: "ID_CARD",
      },
    };
    fetchMock.mockResolvedValue(respond(200, attempt));

    await expect(getCustomerAttempt("tok")).resolves.toEqual(attempt);
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers/onboarding/customer");
    expect(init?.method).toBe("GET");
  });

  it("reads the open request for information with its sections, or null", async () => {
    const rfi = {
      id: "rfi_1",
      status: "pending",
      request: [
        {
          title: "PROOF OF ADDRESS",
          description: "Please upload a new one.",
          fields: [
            {
              key: "proof_of_address_type",
              label: "Proof of address type",
              required: true,
              items: [{ label: "Utility bill", value: "UTILITY_BILL" }],
            },
            { key: "proof_of_address_file", label: "Proof of address file", required: true },
          ],
        },
      ],
      expiresAt: "2026-11-26T12:00:00.000Z",
      createdAt: "2026-10-30T12:00:00.000Z",
    };
    fetchMock
      .mockResolvedValueOnce(respond(200, rfi))
      .mockResolvedValueOnce(new Response("null", { status: 200 }));

    await expect(getOpenRfi("tok")).resolves.toEqual(rfi);
    await expect(getOpenRfi("tok")).resolves.toBeNull();
    expect(request().url).toBe("http://api.test/api/producers/onboarding/rfi");
  });

  it("submits the single answer to the request, which answers 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const answers = { proof_of_address_type: "UTILITY_BILL", website: ["https://casa.example"] };

    await expect(submitRfi("tok", answers, "key-rfi")).resolves.toBeUndefined();
    const { url, init } = request();
    expect(url).toBe("http://api.test/api/producers/onboarding/rfi");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "key-rfi" });
    expect(init?.body).toBe(JSON.stringify(answers));
  });

  it("reports the field of a refused answer", async () => {
    fetchMock.mockResolvedValue(
      respond(400, { code: "invalid_rfi_response", message: "", field: "website" }),
    );

    const error: unknown = await submitRfi("tok", { website: "casa" }, "key-rfi").catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "invalid_rfi_response" });
    expect((error as ApiError).body).toMatchObject({ field: "website" });
  });

  it("prepares the producer's activation and sends its signature", async () => {
    const hash = "a".repeat(64);
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: "signing", hashToSign: hash }))
      .mockResolvedValueOnce(respond(200, { status: "active", transactionHash: hash }));

    await expect(prepareProducerActivation("tok")).resolves.toEqual({
      status: "signing",
      hashToSign: hash,
    });
    await expect(
      submitProducerActivationSignature("tok", { hash, signature: "0xsig" }),
    ).resolves.toEqual({ status: "active", transactionHash: hash });

    expect(request(0).url).toBe("http://api.test/api/producers/onboarding/stellar/activate");
    expect(request(0).init?.method).toBe("POST");
    expect(request(0).init?.body).toBeNull();
    expect(request(1).url).toBe(
      "http://api.test/api/producers/onboarding/stellar/activate/signature",
    );
    expect(request(1).init?.body).toBe(JSON.stringify({ hash, signature: "0xsig" }));
  });
});
