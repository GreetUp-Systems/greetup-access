import "reflect-metadata";

import { createHmac, randomUUID } from "node:crypto";

import { type ApiConfig } from "@access/config";
import { PrismaClient, PrismaService, TenantContextService } from "@access/database";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Keypair } from "@stellar/stellar-sdk";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import { BlindPayWebhookPrismaService } from "../src/common/blindpay/blindpay-webhook-prisma.service";
import {
  BLINDPAY_GATEWAY,
  type BlindPayCreatedCustomer,
  type BlindPayCustomerAttempt,
  type BlindPayCustomerKyc,
  type BlindPayGateway,
  type BlindPayKycStatusValue,
  BlindPayProviderError,
  type BlindPayRfi,
  type BlindPayRfiAnswers,
  type BlindPayTermsSession,
  type BlindPayUploadedDocument,
} from "../src/common/blindpay/blindpay.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  type PrivyIdentity,
  type PrivyStellarWallet,
  type VerifiedPrivyPrincipal,
} from "../src/common/privy/privy.types";
import {
  STELLAR_GATEWAY,
  type PreparedStellarProvisioning,
  type StellarAccountState,
  type StellarGateway,
  StellarProviderError,
  type StellarTransactionStatus,
} from "../src/common/stellar/stellar.types";
import { STALE_CUSTOMER_ATTEMPT_MS } from "../src/producers/producer-onboarding.repository";
import { stellarTestConfig } from "./test-stellar-config";
import { ticketsTestConfig } from "./test-tickets-config";

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const runtimeDatabaseUrl = "postgresql://access_runtime:test_runtime@localhost:5433/access_test";
const webhookSecretBytes = Buffer.from("test", "utf8");

const baseConfig: ApiConfig = {
  nodeEnv: "test",
  apiPort: 0,
  databaseUrl: runtimeDatabaseUrl,
  databaseDirectUrl: ownerDatabaseUrl,
  redisUrl: "redis://localhost:6380",
  healthCheckTimeoutMs: 250,
  privyAppId: "test-app-id",
  privyAppSecret: "test-app-secret",
  privyJwtVerificationKey: "test-verification-key",
  privyApiTimeoutMs: 500,
  databaseBlindPayWebhookUrl:
    "postgresql://access_blindpay_webhook_login:test_webhook@localhost:5433/access_test",
  blindPayApiKey: "blindpay-test-key",
  blindPayInstanceId: "in_test",
  blindPayBaseUrl: "https://api.blindpay.com/v1",
  blindPayWebhookSecret: "whsec_dGVzdA==",
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  blindPayPartnerFeeId: undefined,
  ticketMinPriceCents: 6_000,
  purchaseMaxTotalCents: 4_000_000,
  corsOrigins: [],
  ...stellarTestConfig,
  ...ticketsTestConfig,
};

// Wallet keys generated at runtime: the test signs the prepared hash as the browser would (D-28).
const keyA = Keypair.random();
const keyB = Keypair.random();
const sign = (key: Keypair, hash: string): string =>
  `0x${key.sign(Buffer.from(hash, "hex")).toString("hex")}`;

const users = {
  a: {
    token: "producer-a-token",
    privyUserId: "did:privy:producer-a",
    email: "producer-a@example.com",
    walletId: "producer-a-wallet",
    address: keyA.publicKey(),
    key: keyA,
  },
  b: {
    token: "producer-b-token",
    privyUserId: "did:privy:producer-b",
    email: "producer-b@example.com",
    walletId: "producer-b-wallet",
    address: keyB.publicKey(),
    key: keyB,
  },
};

class FakePrivyGateway implements PrivyGateway {
  readonly tokenPrincipals = new Map<string, VerifiedPrivyPrincipal>();
  readonly identities = new Map<string, PrivyIdentity>();
  readonly wallets = new Map<string, PrivyStellarWallet>();

  reset(): void {
    this.tokenPrincipals.clear();
    this.identities.clear();
    this.wallets.clear();

    for (const user of Object.values(users)) {
      this.tokenPrincipals.set(user.token, {
        privyUserId: user.privyUserId,
        sessionId: `${user.walletId}-session`,
      });
      this.identities.set(user.privyUserId, {
        privyUserId: user.privyUserId,
        verifiedEmail: user.email,
      });
    }
  }

  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const principal = this.tokenPrincipals.get(token);
    if (principal === undefined) {
      throw new Error("invalid token");
    }
    return principal;
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    const identity = this.identities.get(privyUserId);
    if (identity === undefined) {
      throw new Error("unknown identity");
    }
    return identity;
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.wallets.get(privyUserId) ?? null;
  }

  async createStellarWallet(privyUserId: string): Promise<PrivyStellarWallet> {
    const user = Object.values(users).find((candidate) => candidate.privyUserId === privyUserId);
    if (user === undefined) {
      throw new Error("unknown identity");
    }

    const wallet = {
      id: user.walletId,
      address: user.address,
      chainType: "stellar" as const,
      ownerPrivyUserId: privyUserId,
    };
    this.wallets.set(privyUserId, wallet);
    return wallet;
  }
}

class FakeBlindPayGateway implements BlindPayGateway {
  termsInputs: Array<{ idempotencyKey: string; redirectUrl: string }> = [];
  uploadInputs: Array<{
    input: { filename: string; mimeType: string; content: Buffer };
    idempotencyKey: string;
  }> = [];
  customerInputs: Array<{ input: Record<string, unknown>; idempotencyKey: string }> = [];
  rfiSubmissions: Array<{
    customerId: string;
    answers: BlindPayRfiAnswers;
    idempotencyKey: string;
  }> = [];
  walletRegistrations: Array<{
    input: { customerId: string; address: string; name: string };
    idempotencyKey: string;
  }> = [];
  openRfi: BlindPayRfi | null = null;
  nextCustomerError: BlindPayProviderError | undefined;
  nextCustomerKycStatus: BlindPayKycStatusValue = "verifying";
  // BlindPay's OpenAPI lets updated_at be null; the tests on event order set it.
  nextCustomerUpdatedAt: Date | null = null;
  nextKycReadError: BlindPayProviderError | undefined;
  attempt: BlindPayCustomerAttempt | undefined;
  attemptError: BlindPayProviderError | undefined;
  attemptReads: string[] = [];
  // Runs after BlindPay "created" the customer and before the API hears back, like a webhook that
  // arrives while the request is still in flight.
  onCustomerCreated: ((customerId: string) => Promise<void>) | undefined;
  // BlindPay replays the response of a repeated Idempotency-Key with an identical body.
  private readonly customerIdsByKey = new Map<string, string>();
  private customerSequence = 0;

  reset(): void {
    this.customerIdsByKey.clear();
    this.onCustomerCreated = undefined;
    this.attempt = undefined;
    this.attemptError = undefined;
    this.attemptReads = [];
    this.termsInputs = [];
    this.uploadInputs = [];
    this.customerInputs = [];
    this.rfiSubmissions = [];
    this.walletRegistrations = [];
    this.openRfi = null;
    this.nextCustomerError = undefined;
    this.nextCustomerKycStatus = "verifying";
    this.nextCustomerUpdatedAt = null;
    this.nextKycReadError = undefined;
    this.customerSequence = 0;
  }

  async createTermsOfServiceUrl(input: {
    idempotencyKey: string;
    redirectUrl: string;
  }): Promise<BlindPayTermsSession> {
    this.termsInputs.push(input);
    return { url: "https://app.blindpay.com/e/terms-of-service?session_token=test" };
  }

  async uploadDocument(
    input: { filename: string; mimeType: string; content: Buffer },
    idempotencyKey: string,
  ): Promise<BlindPayUploadedDocument> {
    this.uploadInputs.push({ input, idempotencyKey });
    return { fileUrl: "https://files.blindpay.com/test-document.pdf" };
  }

  async createCustomer(
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BlindPayCreatedCustomer> {
    this.customerInputs.push({ input, idempotencyKey });
    if (this.nextCustomerError !== undefined) {
      const error = this.nextCustomerError;
      this.nextCustomerError = undefined;
      throw error;
    }
    const replayed = this.customerIdsByKey.get(idempotencyKey);
    if (replayed !== undefined) {
      return { id: replayed };
    }
    this.customerSequence += 1;
    const id = `re_test_${this.customerSequence}`;
    this.customerIdsByKey.set(idempotencyKey, id);
    await this.onCustomerCreated?.(id);
    return { id };
  }

  async getCustomerKyc(): Promise<BlindPayCustomerKyc> {
    if (this.nextKycReadError !== undefined) {
      const error = this.nextKycReadError;
      this.nextKycReadError = undefined;
      throw error;
    }
    return { kycStatus: this.nextCustomerKycStatus, updatedAt: this.nextCustomerUpdatedAt };
  }

  async getCustomerAttempt(customerId: string): Promise<BlindPayCustomerAttempt> {
    this.attemptReads.push(customerId);
    if (this.attemptError !== undefined) {
      throw this.attemptError;
    }
    if (this.attempt === undefined) {
      throw new Error("no attempt configured");
    }
    return this.attempt;
  }

  async getOpenRfi(): Promise<BlindPayRfi | null> {
    return this.openRfi;
  }

  async submitRfi(
    customerId: string,
    answers: BlindPayRfiAnswers,
    idempotencyKey: string,
  ): Promise<void> {
    this.rfiSubmissions.push({ customerId, answers, idempotencyKey });
  }

  async registerExternalStellarWallet(
    input: {
      customerId: string;
      address: string;
      name: string;
    },
    idempotencyKey: string,
  ): Promise<{ id: string; address: string; network: "stellar_testnet" }> {
    this.walletRegistrations.push({ input, idempotencyKey });
    return { id: "bw_test_1", address: input.address, network: "stellar_testnet" };
  }

  // Checkout is covered by purchases.integration.spec.ts.
  async createPayinQuote(): Promise<never> {
    throw new Error("not used by producer tests");
  }

  async createPayin(): Promise<never> {
    throw new Error("not used by producer tests");
  }
}

const configuredTrustlines = [
  { code: stellarTestConfig.stellarAssetCode, issuer: stellarTestConfig.stellarAssetIssuer },
  { code: "USDC", issuer: stellarTestConfig.stellarUsdcAssetIssuer },
];
const unfundedState: StellarAccountState = {
  accountExists: false,
  missingTrustlines: configuredTrustlines,
};
const provisionedState: StellarAccountState = { accountExists: true, missingTrustlines: [] };

class FakeStellarGateway implements StellarGateway {
  readonly states = new Map<string, StellarAccountState>();
  readonly transactionStatuses = new Map<string, StellarTransactionStatus>();
  buildInputs: Array<{ producerAddress: string; state: StellarAccountState }> = [];
  nextBuildError: StellarProviderError | undefined;
  submissionInputs: Array<{
    prepared: PreparedStellarProvisioning;
    producerAddress: string;
    producerSignature: string;
  }> = [];

  reset(): void {
    this.states.clear();
    this.transactionStatuses.clear();
    this.buildInputs = [];
    this.nextBuildError = undefined;
    this.submissionInputs = [];
  }

  async getAccountState(address: string): Promise<StellarAccountState> {
    return this.states.get(address) ?? unfundedState;
  }

  async buildProvisioningTransaction(
    producerAddress: string,
    state: StellarAccountState,
  ): Promise<PreparedStellarProvisioning> {
    this.buildInputs.push({ producerAddress, state });
    if (this.nextBuildError !== undefined) {
      const error = this.nextBuildError;
      this.nextBuildError = undefined;
      throw error;
    }
    return {
      transactionXdr: `xdr-${producerAddress}`,
      transactionHash: createHmac("sha256", "stellar-test")
        .update(`${producerAddress}:${this.buildInputs.length}`)
        .digest("hex"),
    };
  }

  async submitProvisioningTransaction(
    prepared: PreparedStellarProvisioning,
    producerAddress: string,
    producerSignature: string,
  ): Promise<{ transactionHash: string }> {
    this.submissionInputs.push({ prepared, producerAddress, producerSignature });
    this.states.set(producerAddress, provisionedState);
    this.transactionStatuses.set(prepared.transactionHash, "success");
    return { transactionHash: prepared.transactionHash };
  }

  async getTransactionStatus(transactionHash: string): Promise<StellarTransactionStatus> {
    return this.transactionStatuses.get(transactionHash) ?? "not_found";
  }
}

const individualCustomer = {
  type: "individual",
  kycType: "standard",
  tosId: "tos_test",
  taxId: "12345678900",
  addressLine1: "Rua Teste 100",
  city: "Sao Paulo",
  stateProvinceRegion: "SP",
  country: "BR",
  postalCode: "01001000",
  phoneNumber: "+5511999999999",
  firstName: "Ana",
  lastName: "Produtora",
  dateOfBirth: "1990-01-01T00:00:00Z",
  idDocCountry: "BR",
  idDocType: "PASSPORT",
  idDocFrontFile: "https://files.blindpay.com/id-front.pdf",
  selfieFile: "https://files.blindpay.com/selfie.png",
} as const;

const businessCustomer = {
  type: "business",
  kycType: "standard",
  tosId: "tos_business_test",
  taxId: "12345678000199",
  addressLine1: "Avenida Empresa 200",
  city: "Sao Paulo",
  stateProvinceRegion: "SP",
  country: "BR",
  postalCode: "01001000",
  phoneNumber: "+5511999999999",
  legalName: "Access Eventos Ltda",
  formationDate: "2020-01-01T00:00:00Z",
  owners: [
    {
      role: "beneficial_controlling",
      title: "CEO",
      ownershipPercentage: 100,
      firstName: "Ana",
      lastName: "Produtora",
      dateOfBirth: "1990-01-01T00:00:00Z",
      taxId: "12345678900",
      addressLine1: "Rua Teste 100",
      city: "Sao Paulo",
      stateProvinceRegion: "SP",
      country: "BR",
      postalCode: "01001000",
      idDocCountry: "BR",
      idDocType: "PASSPORT",
      idDocFrontFile: "https://files.blindpay.com/owner-id.pdf",
    },
  ],
  incorporationDocFile: "https://files.blindpay.com/incorporation.pdf",
  proofOfOwnershipDocFile: "https://files.blindpay.com/ownership.pdf",
} as const;

describe("producer profile and RLS integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let runtimePrisma: PrismaService;
  let webhookPrisma: BlindPayWebhookPrismaService;
  let tenantContext: TenantContextService;
  const privy = new FakePrivyGateway();
  const blindPay = new FakeBlindPayGateway();
  const stellar = new FakeStellarGateway();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.forRoot(baseConfig)],
    })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .overrideProvider(BLINDPAY_GATEWAY)
      .useValue(blindPay)
      .overrideProvider(STELLAR_GATEWAY)
      .useValue(stellar)
      .compile();

    app = module.createNestApplication();
    configureApplication(app);
    await app.init();

    ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
    runtimePrisma = app.get(PrismaService);
    webhookPrisma = app.get(BlindPayWebhookPrismaService);
    tenantContext = app.get(TenantContextService);
  });

  beforeEach(async () => {
    await ownerPrisma.blindPayWebhookDelivery.deleteMany();
    await ownerPrisma.emailNotification.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.ticket.deleteMany();
    await ownerPrisma.purchase.deleteMany();
    await ownerPrisma.ticketType.deleteMany();
    await ownerPrisma.event.deleteMany();
    await ownerPrisma.stellarAccountProvisioning.deleteMany();
    await ownerPrisma.blindPayCustomer.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
    privy.reset();
    blindPay.reset();
    stellar.reset();
  });

  afterAll(async () => {
    await ownerPrisma.blindPayWebhookDelivery.deleteMany();
    await ownerPrisma.emailNotification.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.ticket.deleteMany();
    await ownerPrisma.purchase.deleteMany();
    await ownerPrisma.ticketType.deleteMany();
    await ownerPrisma.event.deleteMany();
    await ownerPrisma.stellarAccountProvisioning.deleteMany();
    await ownerPrisma.blindPayCustomer.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
    await app.close();
    await ownerPrisma.$disconnect();
  });

  async function bootstrap(token: string): Promise<void> {
    await request(app.getHttpServer())
      .post("/api/auth/bootstrap")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  }

  async function createProducer(token = users.a.token): Promise<void> {
    await bootstrap(token);
    await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Festival Access" })
      .expect(200);
  }

  function readAttempt() {
    return request(app.getHttpServer())
      .get("/api/producers/onboarding/customer")
      .set("Authorization", `Bearer ${users.a.token}`);
  }

  async function createBlindPayCustomer(idempotencyKey = randomUUID()) {
    return request(app.getHttpServer())
      .post("/api/producers/onboarding/customer")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(individualCustomer);
  }

  function signWebhook(rawBody: string, messageId: string, timestamp: number): string {
    return createHmac("sha256", webhookSecretBytes)
      .update(Buffer.from(`${messageId}.${timestamp}.${rawBody}`, "utf8"))
      .digest("base64");
  }

  function deliverWebhook(payload: string, messageId: string) {
    const timestamp = Math.floor(Date.now() / 1_000);
    return request(app.getHttpServer())
      .post("/api/webhooks/blindpay")
      .set("Content-Type", "application/json")
      .set("svix-id", messageId)
      .set("svix-timestamp", String(timestamp))
      .set("svix-signature", `v1,${signWebhook(payload, messageId, timestamp)}`)
      .send(payload);
  }

  // Ages the pending attempt past the deadline that frees the producer (SPEC-003 v1.8).
  async function ageAttempts(): Promise<void> {
    const sentAt = new Date(Date.now() - STALE_CUSTOMER_ATTEMPT_MS - 60_000);
    await ownerPrisma.blindPayCustomer.updateMany({
      data: { createdAt: sentAt, updatedAt: sentAt },
    });
  }

  it("requires authentication and a bootstrapped account", async () => {
    await request(app.getHttpServer())
      .post("/api/producers")
      .send({ displayName: "A" })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ displayName: "A" })
      .expect(404);

    expect(response.body).toMatchObject({ code: "account_not_bootstrapped" });
  });

  it("creates and reads one producer profile for the authenticated account", async () => {
    await bootstrap(users.a.token);

    const created = await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ displayName: "  Festival Access  " })
      .expect(200);

    expect(created.body).toMatchObject({
      id: expect.any(String),
      displayName: "Festival Access",
      onboardingStatus: "stellar_pending",
      compliance: { status: null, hasOpenRfi: false },
      stellar: { status: "not_started" },
    });

    const current = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);

    expect(current.body).toEqual(created.body);
    await expect(ownerPrisma.producerProfile.count()).resolves.toBe(1);
  });

  it("is idempotent under repeated and concurrent requests", async () => {
    await bootstrap(users.a.token);

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app.getHttpServer())
          .post("/api/producers")
          .set("Authorization", `Bearer ${users.a.token}`)
          .send({ displayName: "Festival Access" }),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(responses[0]?.body).toEqual(responses[1]?.body);
    await expect(ownerPrisma.producerProfile.count()).resolves.toBe(1);

    const conflict = await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ displayName: "Another producer" })
      .expect(409);
    expect(conflict.body).toMatchObject({ code: "producer_already_exists" });
  });

  it("rejects identity and tenant selector fields from the client", async () => {
    await bootstrap(users.a.token);

    const response = await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ displayName: "Festival", producerId: "another-tenant" })
      .expect(400);

    expect(response.body).toMatchObject({ code: "invalid_producer_profile" });
  });

  it("enforces RLS with a restricted role and does not leak pooled context", async () => {
    await bootstrap(users.a.token);
    await bootstrap(users.b.token);

    const userA = await ownerPrisma.user.findUniqueOrThrow({
      where: { privyUserId: users.a.privyUserId },
    });
    const userB = await ownerPrisma.user.findUniqueOrThrow({
      where: { privyUserId: users.b.privyUserId },
    });

    await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ displayName: "Producer A" })
      .expect(200);

    await expect(runtimePrisma.producerProfile.findMany()).resolves.toEqual([]);

    await expect(
      tenantContext.withUserContext(userA.id, (transaction) =>
        transaction.producerProfile.create({
          data: { userId: userB.id, displayName: "Cross tenant" },
        }),
      ),
    ).rejects.toBeDefined();

    await request(app.getHttpServer())
      .post("/api/producers")
      .set("Authorization", `Bearer ${users.b.token}`)
      .send({ displayName: "Producer B" })
      .expect(200);

    const visibleToA = await tenantContext.withUserContext(userA.id, (transaction) =>
      transaction.producerProfile.findMany(),
    );
    const visibleToB = await tenantContext.withUserContext(userB.id, (transaction) =>
      transaction.producerProfile.findMany(),
    );

    expect(visibleToA.map(({ displayName }) => displayName)).toEqual(["Producer A"]);
    expect(visibleToB.map(({ displayName }) => displayName)).toEqual(["Producer B"]);

    const producerContext = await tenantContext.withProducerContext(
      userA.id,
      async (transaction, producerId) => ({
        producerId,
        visibleProfiles: await transaction.producerProfile.count(),
      }),
    );
    expect(producerContext).toEqual({
      producerId: visibleToA[0]?.id,
      visibleProfiles: 1,
    });

    const customerA = await ownerPrisma.blindPayCustomer.create({
      data: {
        producerId: visibleToA[0]!.id,
        providerIdempotencyKey: "a".repeat(64),
        customerType: "INDIVIDUAL",
        externalCustomerId: "re_rls_a",
        creationStatus: "CREATED",
        kycStatus: "VERIFYING",
      },
    });
    await expect(
      tenantContext.withProducerContext(userA.id, (transaction) =>
        transaction.blindPayCustomer.count(),
      ),
    ).resolves.toBe(1);
    await expect(
      tenantContext.withProducerContext(userB.id, (transaction) =>
        transaction.blindPayCustomer.count(),
      ),
    ).resolves.toBe(0);
    await expect(
      tenantContext.withProducerContext(userB.id, (transaction) =>
        transaction.blindPayCustomer.updateMany({
          where: { id: customerA.id },
          data: { kycStatus: "APPROVED" },
        }),
      ),
    ).resolves.toMatchObject({ count: 0 });

    const walletA = await ownerPrisma.walletAccount.findUniqueOrThrow({
      where: { userId: userA.id },
    });
    const provisioningA = await ownerPrisma.stellarAccountProvisioning.create({
      data: {
        producerId: visibleToA[0]!.id,
        walletAccountId: walletA.id,
        network: "testnet",
      },
    });
    await expect(
      tenantContext.withProducerContext(userA.id, (transaction) =>
        transaction.stellarAccountProvisioning.count(),
      ),
    ).resolves.toBe(1);
    await expect(
      tenantContext.withProducerContext(userB.id, (transaction) =>
        transaction.stellarAccountProvisioning.count(),
      ),
    ).resolves.toBe(0);
    await expect(
      tenantContext.withProducerContext(userB.id, (transaction) =>
        transaction.stellarAccountProvisioning.updateMany({
          where: { id: provisioningA.id },
          data: { status: "ACTIVE" },
        }),
      ),
    ).resolves.toMatchObject({ count: 0 });
    await expect(runtimePrisma.producerProfile.findMany()).resolves.toEqual([]);

    const [role] = await runtimePrisma.$queryRaw<
      Array<{ isSuperuser: boolean; canBypassRls: boolean; isRuntimeMember: boolean }>
    >`
      SELECT
        current_setting('is_superuser') = 'on' AS "isSuperuser",
        rolbypassrls AS "canBypassRls",
        pg_has_role(current_user, 'access_app_runtime', 'member') AS "isRuntimeMember"
      FROM pg_roles
      WHERE rolname = current_user
    `;

    expect(role).toEqual({
      isSuperuser: false,
      canBypassRls: false,
      isRuntimeMember: true,
    });
  });

  it("rejects an owner connection when configured as the API runtime", async () => {
    const unsafeRuntime = new PrismaService(ownerDatabaseUrl, true, "access_app_runtime");

    try {
      await expect(unsafeRuntime.assertRestrictedRuntimeRole()).rejects.toThrow(
        "The database URL must use the restricted access_app_runtime role.",
      );
    } finally {
      await unsafeRuntime.$disconnect();
    }
  });

  it("creates Terms of Service sessions only for allowed redirect origins", async () => {
    await createProducer();

    const accepted = await request(app.getHttpServer())
      .post("/api/producers/onboarding/tos")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ redirectUrl: "http://localhost:3000/onboarding/return" })
      .expect(200);

    expect(accepted.body).toEqual({
      url: "https://app.blindpay.com/e/terms-of-service?session_token=test",
    });
    expect(blindPay.termsInputs).toEqual([
      {
        idempotencyKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        redirectUrl: "http://localhost:3000/onboarding/return",
      },
    ]);

    const rejected = await request(app.getHttpServer())
      .post("/api/producers/onboarding/tos")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ redirectUrl: "https://attacker.example/return" })
      .expect(400);
    expect(rejected.body).toMatchObject({ code: "redirect_origin_not_allowed" });
  });

  it("forwards bounded onboarding files without persisting their contents", async () => {
    await createProducer();
    const idempotencyKey = randomUUID();
    const contents = Buffer.from("test identity document", "utf8");

    const response = await request(app.getHttpServer())
      .post("/api/producers/onboarding/files")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", idempotencyKey)
      .attach("file", contents, { filename: "identity.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(response.body).toEqual({ fileUrl: "https://files.blindpay.com/test-document.pdf" });
    expect(blindPay.uploadInputs).toHaveLength(1);
    expect(blindPay.uploadInputs[0]).toMatchObject({
      input: { filename: "identity.pdf", mimeType: "application/pdf", content: contents },
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    await expect(ownerPrisma.blindPayCustomer.count()).resolves.toBe(0);
  });

  it("creates an idempotent customer using server-owned identity fields", async () => {
    await createProducer();
    const idempotencyKey = randomUUID();

    const first = await createBlindPayCustomer(idempotencyKey);
    const repeated = await createBlindPayCustomer(idempotencyKey);

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(first.body);
    expect(first.body).toMatchObject({
      id: expect.any(String),
      customerId: "re_test_1",
      type: "individual",
      status: "verifying",
    });
    expect(blindPay.customerInputs).toHaveLength(1);
    expect(blindPay.customerInputs[0]?.input).toMatchObject({
      email: users.a.email,
      external_id: expect.any(String),
      type: "individual",
      kyc_type: "standard",
    });
    // The body is the same from any network: BlindPay replays a key only for an identical body.
    expect(blindPay.customerInputs[0]?.input).not.toHaveProperty("ip_address");
    expect(blindPay.customerInputs[0]?.input).not.toHaveProperty("idempotency_key");

    const stored = await ownerPrisma.blindPayCustomer.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      externalCustomerId: "re_test_1",
      creationStatus: "CREATED",
      kycStatus: "VERIFYING",
      isCurrent: true,
    });
    expect(JSON.stringify(stored)).not.toContain(individualCustomer.taxId);
    expect(JSON.stringify(stored)).not.toContain(individualCustomer.idDocFrontFile);
  });

  it("persists immediate provider approval and emits its outbox event atomically", async () => {
    await createProducer();
    blindPay.nextCustomerKycStatus = "approved";
    const idempotencyKey = randomUUID();

    const created = await createBlindPayCustomer(idempotencyKey);
    const repeated = await createBlindPayCustomer(idempotencyKey);

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ customerId: "re_test_1", status: "approved" });
    expect(repeated.body).toEqual(created.body);
    expect(blindPay.customerInputs).toHaveLength(1);
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      creationStatus: "CREATED",
      kycStatus: "APPROVED",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
  });

  it("maps a business customer and its owners without persisting the KYB dossier", async () => {
    await createProducer();

    const response = await request(app.getHttpServer())
      .post("/api/producers/onboarding/customer")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", randomUUID())
      .send(businessCustomer)
      .expect(200);

    expect(response.body).toMatchObject({
      customerId: "re_test_1",
      type: "business",
      status: "verifying",
    });
    expect(blindPay.customerInputs[0]?.input).toMatchObject({
      type: "business",
      kyc_type: "standard",
      email: users.a.email,
      legal_name: businessCustomer.legalName,
      owners: [
        expect.objectContaining({
          role: "beneficial_controlling",
          ownership_percentage: 100,
          id_doc_front_file: businessCustomer.owners[0].idDocFrontFile,
        }),
      ],
    });
    const stored = await ownerPrisma.blindPayCustomer.findMany();
    expect(JSON.stringify(stored)).not.toContain(businessCustomer.taxId);
    expect(JSON.stringify(stored)).not.toContain(businessCustomer.legalName);
  });

  it("keeps rejected attempts as history and permits a corrected new attempt", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError(
      "create_customer",
      false,
      422,
      "invalid_customer",
    );

    const rejected = await createBlindPayCustomer();
    expect(rejected.status).toBe(422);
    expect(rejected.body).toMatchObject({
      code: "customer_creation_failed",
      providerCode: "invalid_customer",
    });
    // A first attempt has nothing to give the current flag back to.
    await expect(ownerPrisma.blindPayCustomer.count({ where: { isCurrent: true } })).resolves.toBe(
      0,
    );

    const corrected = await createBlindPayCustomer();
    expect(corrected.status).toBe(200);
    expect(corrected.body).toMatchObject({ customerId: "re_test_1", status: "verifying" });

    const attempts = await ownerPrisma.blindPayCustomer.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      creationStatus: "FAILED",
      failureCode: "invalid_customer",
      isCurrent: false,
    });
    expect(attempts[1]).toMatchObject({ creationStatus: "CREATED", isCurrent: true });
  });

  it("reads the current attempt live from BlindPay without storing it", async () => {
    await createProducer();
    const missing = await readAttempt().expect(404);
    expect(missing.body).toMatchObject({ code: "blindpay_customer_not_found" });

    await createBlindPayCustomer();
    const draft = {
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
      idDocType: "ID_CARD" as const,
    };
    blindPay.attempt = {
      status: "rejected",
      warnings: [{ code: "BIRTH_DATE_MISMATCH", message: "Mismatch between birth dates." }],
      draft,
    };
    const stored = await ownerPrisma.blindPayCustomer.findFirstOrThrow();
    const outboxBefore = await ownerPrisma.outboxEvent.count();

    const rejected = await readAttempt().expect(200);
    expect(rejected.body).toEqual({
      status: "rejected",
      reasons: [{ code: "BIRTH_DATE_MISMATCH", message: "Mismatch between birth dates." }],
      draft,
    });
    expect(blindPay.attemptReads).toEqual(["re_test_1"]);
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toEqual(stored);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(outboxBefore);

    blindPay.attemptError = new BlindPayProviderError("get_customer", true, 503);
    const unavailable = await readAttempt().expect(503);
    expect(unavailable.body).toMatchObject({ code: "compliance_provider_unavailable" });
    blindPay.attemptError = new BlindPayProviderError("get_customer", false, 404, "not_found");
    const failed = await readAttempt().expect(422);
    expect(failed.body).toMatchObject({ code: "customer_fetch_failed" });
  });

  it("keeps a created customer when its status read fails, for the webhook to settle", async () => {
    await createProducer();
    blindPay.nextCustomerKycStatus = "approved";
    blindPay.nextKycReadError = new BlindPayProviderError("get_customer", true, 503);

    const created = await createBlindPayCustomer();

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ customerId: "re_test_1", status: "verifying" });
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      externalCustomerId: "re_test_1",
      creationStatus: "CREATED",
      kycStatus: "VERIFYING",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
  });

  it("keeps the attempt open when the creation outcome is uncertain and resumes it", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError(
      "create_customer_invalid_response",
      true,
      200,
    );
    const idempotencyKey = randomUUID();

    const uncertain = await createBlindPayCustomer(idempotencyKey);
    expect(uncertain.status).toBe(503);
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      creationStatus: "PENDING",
      failureCode: null,
    });

    const resumed = await createBlindPayCustomer(idempotencyKey);
    expect(resumed.status).toBe(200);
    expect(blindPay.customerInputs).toHaveLength(2);
    expect(blindPay.customerInputs[1]?.idempotencyKey).toBe(
      blindPay.customerInputs[0]?.idempotencyKey,
    );
    await expect(ownerPrisma.blindPayCustomer.count()).resolves.toBe(1);
  });

  it("blocks a new submission while an attempt is pending and closes it after the deadline", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);

    const blocked = await createBlindPayCustomer();
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: "customer_attempt_already_active" });
    expect(blindPay.customerInputs).toHaveLength(1);

    await ageAttempts();
    const resumed = await createBlindPayCustomer();
    expect(resumed.status).toBe(200);
    expect(resumed.body).toMatchObject({ customerId: "re_test_1", status: "verifying" });

    const attempts = await ownerPrisma.blindPayCustomer.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      creationStatus: "FAILED",
      failureCode: "attempt_abandoned",
      isCurrent: false,
    });
    expect(attempts[1]).toMatchObject({ creationStatus: "CREATED", isCurrent: true });
  });

  it("restarts the deadline when the same submission is sent again", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    const idempotencyKey = randomUUID();
    expect((await createBlindPayCustomer(idempotencyKey)).status).toBe(503);
    await ageAttempts();

    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer(idempotencyKey)).status).toBe(503);

    // The resend may still create the customer: a newer submission must not close it now.
    const newer = await createBlindPayCustomer();
    expect(newer.status).toBe(409);
    expect(blindPay.customerInputs).toHaveLength(2);
    await expect(ownerPrisma.blindPayCustomer.findMany()).resolves.toEqual([
      expect.objectContaining({ creationStatus: "PENDING", isCurrent: true }),
    ]);
  });

  it("answers both copies of a submission sent twice over a stale attempt with one attempt", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    await ageAttempts();

    const idempotencyKey = randomUUID();
    const responses = await Promise.all([
      createBlindPayCustomer(idempotencyKey),
      createBlindPayCustomer(idempotencyKey),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0]?.body).toEqual(responses[1]?.body);
    await expect(ownerPrisma.blindPayCustomer.count({ where: { isCurrent: true } })).resolves.toBe(
      1,
    );
  });

  it("keeps one current attempt when two submissions close a stale one together", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    await ageAttempts();

    const responses = await Promise.all([createBlindPayCustomer(), createBlindPayCustomer()]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    await expect(ownerPrisma.blindPayCustomer.count({ where: { isCurrent: true } })).resolves.toBe(
      1,
    );
    expect(blindPay.customerInputs).toHaveLength(2);
  });

  it("keeps the latest rejected attempt current when a new attempt fails to be created", async () => {
    await createProducer();
    for (const [index, customerId] of ["re_test_1", "re_test_2"].entries()) {
      expect((await createBlindPayCustomer()).status).toBe(200);
      await deliverWebhook(
        JSON.stringify({
          webhook_event: "customer.update",
          id: customerId,
          kyc_status: "rejected",
        }),
        `msg_customer_rejected_${index}`,
      ).expect(200);
    }

    blindPay.nextCustomerError = new BlindPayProviderError(
      "create_customer",
      false,
      422,
      "invalid_customer",
    );
    const failed = await createBlindPayCustomer();
    expect(failed.status).toBe(422);
    expect(failed.body).toMatchObject({ code: "customer_creation_failed" });

    const attempts = await ownerPrisma.blindPayCustomer.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(attempts).toHaveLength(3);
    expect(attempts[0]).toMatchObject({ externalCustomerId: "re_test_1", isCurrent: false });
    expect(attempts[1]).toMatchObject({
      externalCustomerId: "re_test_2",
      kycStatus: "REJECTED",
      isCurrent: true,
    });
    expect(attempts[2]).toMatchObject({ creationStatus: "FAILED", isCurrent: false });

    const producer = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(producer.body).toMatchObject({ compliance: { status: "rejected" } });

    // The reason and the draft of the rejected attempt are still read from BlindPay.
    blindPay.attempt = {
      status: "rejected",
      warnings: [],
      draft: {
        firstName: "Ana",
        lastName: "Produtora",
        dateOfBirth: "1990-01-01",
        taxId: "12345678900",
        phoneNumber: "+5511999999999",
        addressLine1: "Rua Teste 100",
        addressLine2: null,
        city: "Sao Paulo",
        stateProvinceRegion: "SP",
        postalCode: "01001000",
        country: "BR",
        idDocCountry: "BR",
        idDocType: "PASSPORT",
      },
    };
    await readAttempt().expect(200);
    expect(blindPay.attemptReads).toEqual(["re_test_2"]);
  });

  it("adopts a pending attempt from the customer.new webhook through its external_id", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    const idempotencyKey = randomUUID();
    expect((await createBlindPayCustomer(idempotencyKey)).status).toBe(503);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();

    const payload = JSON.stringify({
      webhook_event: "customer.new",
      id: "re_adopted_1",
      kyc_status: "approved",
      external_id: producer.id,
      created_at: new Date().toISOString(),
    });
    for (let delivery = 0; delivery < 2; delivery += 1) {
      await deliverWebhook(payload, "msg_customer_adopted").expect(200);
    }

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      externalCustomerId: "re_adopted_1",
      creationStatus: "CREATED",
      kycStatus: "APPROVED",
      isCurrent: true,
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);

    // Repeating the same submission answers with the adopted customer, without calling BlindPay.
    const repeated = await createBlindPayCustomer(idempotencyKey);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({ customerId: "re_adopted_1", status: "approved" });
    expect(blindPay.customerInputs).toHaveLength(1);
  });

  it("finishes a creation the webhook already adopted while the request was in flight", async () => {
    await createProducer();
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    blindPay.onCustomerCreated = async (customerId) => {
      await deliverWebhook(
        JSON.stringify({
          webhook_event: "customer.new",
          id: customerId,
          kyc_status: "approved",
          external_id: producer.id,
          created_at: new Date().toISOString(),
        }),
        "msg_customer_in_flight",
      ).expect(200);
    };

    const created = await createBlindPayCustomer();

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ customerId: "re_test_1", status: "approved" });
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      externalCustomerId: "re_test_1",
      creationStatus: "CREATED",
      kycStatus: "APPROVED",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
  });

  it("acknowledges customers it cannot adopt without changing any attempt", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    const before = await ownerPrisma.blindPayCustomer.findMany();

    const now = new Date().toISOString();
    const orphans = [
      // Created an hour before this attempt began: it belongs to an earlier one.
      {
        id: "re_orphan_1",
        external_id: producer.id,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      { id: "re_orphan_2", external_id: randomUUID(), created_at: now },
      { id: "re_orphan_3", created_at: now },
      { id: "re_orphan_4", external_id: "not-a-producer", created_at: now },
    ];
    for (const [index, orphan] of orphans.entries()) {
      const payload = JSON.stringify({
        webhook_event: "customer.new",
        kyc_status: "approved",
        ...orphan,
      });
      await deliverWebhook(payload, `msg_customer_orphan_${index}`).expect(200);
    }

    await expect(ownerPrisma.blindPayCustomer.findMany()).resolves.toEqual(before);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
    await expect(
      ownerPrisma.blindPayWebhookDelivery.count({ where: { processedAt: { not: null } } }),
    ).resolves.toBe(orphans.length);
  });

  it("does not relink a producer whose current attempt is already created", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    const before = await ownerPrisma.blindPayCustomer.findMany();

    await deliverWebhook(
      JSON.stringify({
        webhook_event: "customer.new",
        id: "re_other_1",
        kyc_status: "approved",
        external_id: producer.id,
        created_at: new Date().toISOString(),
      }),
      "msg_customer_other",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findMany()).resolves.toEqual(before);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
  });

  it("adopts a pending attempt as verifying when the status is unknown", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();

    await deliverWebhook(
      JSON.stringify({
        webhook_event: "customer.new",
        id: "re_review_1",
        kyc_status: "pending_review",
        external_id: producer.id,
        created_at: new Date().toISOString(),
      }),
      "msg_customer_unknown_status",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      externalCustomerId: "re_review_1",
      creationStatus: "CREATED",
      kycStatus: "VERIFYING",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
  });

  it("links a pending attempt once when two events of its customer arrive together", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    const event = (webhookEvent: string, kycStatus: string, updatedAt: string) =>
      JSON.stringify({
        webhook_event: webhookEvent,
        id: "re_together_1",
        kyc_status: kycStatus,
        external_id: producer.id,
        created_at: new Date().toISOString(),
        updated_at: updatedAt,
      });

    const deliveries = await Promise.all([
      deliverWebhook(
        event("customer.new", "verifying", "2026-10-30T12:00:00.000Z"),
        "msg_together_new",
      ),
      deliverWebhook(
        event("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
        "msg_together_update",
      ),
    ]);

    expect(deliveries.map((delivery) => delivery.status)).toEqual([200, 200]);
    // Whatever the order, neither event is dropped as an orphan and the newer version stays.
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      externalCustomerId: "re_together_1",
      creationStatus: "CREATED",
      kycStatus: "APPROVED",
      providerUpdatedAt: new Date("2026-10-30T12:01:00.000Z"),
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
    await expect(
      ownerPrisma.blindPayWebhookDelivery.count({ where: { processedAt: { not: null } } }),
    ).resolves.toBe(2);
  });

  it("accepts onboarding files up to 3 MB and refuses larger ones", async () => {
    await createProducer();
    const limit = 3 * 1024 * 1024;
    const upload = (size: number) =>
      request(app.getHttpServer())
        .post("/api/producers/onboarding/files")
        .set("Authorization", `Bearer ${users.a.token}`)
        .set("Idempotency-Key", randomUUID())
        .attach("file", Buffer.alloc(size, 1), {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

    await upload(limit).expect(200);
    const tooLarge = await upload(limit + 1).expect(400);
    expect(tooLarge.body).toMatchObject({ code: "invalid_onboarding_file" });
    // Above the memory guard the upload itself is refused before the service.
    await upload(10 * 1024 * 1024 + 1).expect(413);
    expect(blindPay.uploadInputs).toHaveLength(1);
  });

  it("validates an open RFI dynamically and forwards only declared answers", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);
    blindPay.openRfi = {
      id: "rfi_test",
      status: "pending",
      expiresAt: "2026-10-30T00:00:00.000Z",
      createdAt: "2026-09-30T00:00:00.000Z",
      request: [
        {
          title: "Additional information",
          description: "Compliance details",
          fields: [
            {
              key: "business_description",
              label: "Description",
              required: true,
              regex: "^.{10,}$",
            },
            {
              key: "documents",
              label: "Documents",
              required: true,
              multiple: true,
              items: [
                { label: "Document A", value: "https://files.blindpay.com/a.pdf" },
                { label: "Document B", value: "https://files.blindpay.com/b.pdf" },
              ],
            },
          ],
        },
      ],
    };

    const fetched = await request(app.getHttpServer())
      .get("/api/producers/onboarding/rfi")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(fetched.body).toEqual(blindPay.openRfi);

    await request(app.getHttpServer())
      .post("/api/producers/onboarding/rfi")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ business_description: "too short", undeclared: "value" })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/producers/onboarding/rfi")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        business_description: "A sufficiently detailed answer",
        documents: ["https://files.blindpay.com/not-declared.pdf"],
      })
      .expect(400);

    const answers = {
      business_description: "A sufficiently detailed answer",
      documents: ["https://files.blindpay.com/a.pdf"],
    };
    await request(app.getHttpServer())
      .post("/api/producers/onboarding/rfi")
      .set("Authorization", `Bearer ${users.a.token}`)
      .set("Idempotency-Key", randomUUID())
      .send(answers)
      .expect(204);

    expect(blindPay.rfiSubmissions).toHaveLength(1);
    expect(blindPay.rfiSubmissions[0]).toMatchObject({
      customerId: "re_test_1",
      answers,
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const stored = await ownerPrisma.blindPayCustomer.findMany();
    expect(JSON.stringify(stored)).not.toContain("A sufficiently detailed answer");
  });

  it("processes a signed approval once and rejects tampered or expired webhooks", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    const payload = JSON.stringify({
      webhook_event: "customer.update",
      id: "re_test_1",
      kyc_status: "approved",
    });
    const messageId = "msg_customer_approved";
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature = signWebhook(payload, messageId, timestamp);

    for (let delivery = 0; delivery < 2; delivery += 1) {
      await request(app.getHttpServer())
        .post("/api/webhooks/blindpay")
        .set("Content-Type", "application/json")
        .set("svix-id", messageId)
        .set("svix-timestamp", String(timestamp))
        .set("svix-signature", `v1,${signature}`)
        .send(payload)
        .expect(200);
    }

    await expect(ownerPrisma.blindPayWebhookDelivery.count()).resolves.toBe(1);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      kycStatus: "APPROVED",
    });

    const producer = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(producer.body).toMatchObject({
      onboardingStatus: "stellar_pending",
      compliance: { status: "approved", hasOpenRfi: false },
      stellar: { status: "not_started" },
    });

    await request(app.getHttpServer())
      .post("/api/webhooks/blindpay")
      .set("Content-Type", "application/json")
      .set("svix-id", "msg_tampered")
      .set("svix-timestamp", String(timestamp))
      .set("svix-signature", `v1,${signature}`)
      .send(`${payload} `)
      .expect(401);

    const expiredTimestamp = timestamp - 301;
    await request(app.getHttpServer())
      .post("/api/webhooks/blindpay")
      .set("Content-Type", "application/json")
      .set("svix-id", "msg_expired")
      .set("svix-timestamp", String(expiredTimestamp))
      .set("svix-signature", `v1,${signWebhook(payload, "msg_expired", expiredTimestamp)}`)
      .send(payload)
      .expect(401);

    await expect(ownerPrisma.blindPayWebhookDelivery.count()).resolves.toBe(1);
  });

  it("processes customer.new as an initial KYC lifecycle event", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    const payload = JSON.stringify({
      webhook_event: "customer.new",
      id: "re_test_1",
      kyc_status: "approved",
    });
    const messageId = "msg_customer_created_approved";
    const timestamp = Math.floor(Date.now() / 1_000);

    await request(app.getHttpServer())
      .post("/api/webhooks/blindpay")
      .set("Content-Type", "application/json")
      .set("svix-id", messageId)
      .set("svix-timestamp", String(timestamp))
      .set("svix-signature", `v1,${signWebhook(payload, messageId, timestamp)}`)
      .send(payload)
      .expect(200);

    await expect(ownerPrisma.blindPayWebhookDelivery.count()).resolves.toBe(1);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      kycStatus: "APPROVED",
    });
  });

  // A customer event of re_test_1, the customer the first creation gets, at a BlindPay version.
  const customerEvent = (webhookEvent: string, kycStatus: string, updatedAt?: string) =>
    JSON.stringify({
      webhook_event: webhookEvent,
      id: "re_test_1",
      kyc_status: kycStatus,
      created_at: "2026-10-30T12:00:00.000Z",
      ...(updatedAt === undefined ? {} : { updated_at: updatedAt }),
    });

  it("keeps the latest KYC status when an older event arrives late", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    await deliverWebhook(
      customerEvent("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
      "msg_customer_approved",
    ).expect(200);
    // The creation event, retried after the approval, still carries the first status.
    await deliverWebhook(
      customerEvent("customer.new", "verifying", "2026-10-30T12:00:00.000Z"),
      "msg_customer_created_late",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "APPROVED",
      providerUpdatedAt: new Date("2026-10-30T12:01:00.000Z"),
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
    await expect(
      ownerPrisma.blindPayWebhookDelivery.count({ where: { processedAt: { not: null } } }),
    ).resolves.toBe(2);
  });

  it("does not release the producer for an approval older than the stored status", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    await deliverWebhook(
      customerEvent("customer.update", "compliance_request", "2026-10-30T12:05:00.000Z"),
      "msg_customer_paused",
    ).expect(200);
    await deliverWebhook(
      customerEvent("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
      "msg_customer_approved_late",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "COMPLIANCE_REQUEST",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
  });

  it("settles two events of a customer processed together on the newer version", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    const deliveries = await Promise.all([
      deliverWebhook(
        customerEvent("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
        "msg_customer_approved",
      ),
      deliverWebhook(
        customerEvent("customer.new", "verifying", "2026-10-30T12:00:00.000Z"),
        "msg_customer_created",
      ),
    ]);

    expect(deliveries.map((delivery) => delivery.status)).toEqual([200, 200]);
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "APPROVED",
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
  });

  it("ignores an event with the same updated_at as the stored status", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    await deliverWebhook(
      customerEvent("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
      "msg_customer_approved",
    ).expect(200);
    await deliverWebhook(
      customerEvent("customer.update", "rejected", "2026-10-30T12:01:00.000Z"),
      "msg_customer_same_version",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "APPROVED",
    });
  });

  it("applies an event without updated_at only while no dated status is stored", async () => {
    await createProducer();
    expect((await createBlindPayCustomer()).status).toBe(200);

    await deliverWebhook(customerEvent("customer.update", "approved"), "msg_undated_1").expect(200);
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "APPROVED",
      providerUpdatedAt: null,
    });

    await deliverWebhook(
      customerEvent("customer.update", "compliance_request", "2026-10-30T12:05:00.000Z"),
      "msg_dated",
    ).expect(200);
    await deliverWebhook(customerEvent("customer.update", "approved"), "msg_undated_2").expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "COMPLIANCE_REQUEST",
      providerUpdatedAt: new Date("2026-10-30T12:05:00.000Z"),
    });
    await expect(
      ownerPrisma.blindPayWebhookDelivery.count({ where: { processedAt: { not: null } } }),
    ).resolves.toBe(3);
  });

  it("stores the version read at creation and orders later events against it", async () => {
    await createProducer();
    blindPay.nextCustomerUpdatedAt = new Date("2026-10-30T12:00:30.000Z");
    expect((await createBlindPayCustomer()).status).toBe(200);
    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "VERIFYING",
      providerUpdatedAt: new Date("2026-10-30T12:00:30.000Z"),
    });

    await deliverWebhook(
      customerEvent("customer.new", "verifying", "2026-10-30T12:00:00.000Z"),
      "msg_customer_created",
    ).expect(200);
    await deliverWebhook(
      customerEvent("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
      "msg_customer_approved",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      kycStatus: "APPROVED",
      providerUpdatedAt: new Date("2026-10-30T12:01:00.000Z"),
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
  });

  it("stores the version of the event that adopts a pending attempt", async () => {
    await createProducer();
    blindPay.nextCustomerError = new BlindPayProviderError("create_customer", true, 503);
    expect((await createBlindPayCustomer()).status).toBe(503);
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    const event = (webhookEvent: string, kycStatus: string, updatedAt: string) =>
      JSON.stringify({
        webhook_event: webhookEvent,
        id: "re_adopted_1",
        kyc_status: kycStatus,
        external_id: producer.id,
        created_at: new Date().toISOString(),
        updated_at: updatedAt,
      });

    await deliverWebhook(
      event("customer.update", "approved", "2026-10-30T12:01:00.000Z"),
      "msg_adopting_update",
    ).expect(200);
    await deliverWebhook(
      event("customer.new", "verifying", "2026-10-30T12:00:00.000Z"),
      "msg_adopted_created_late",
    ).expect(200);

    await expect(ownerPrisma.blindPayCustomer.findFirstOrThrow()).resolves.toMatchObject({
      externalCustomerId: "re_adopted_1",
      kycStatus: "APPROVED",
      providerUpdatedAt: new Date("2026-10-30T12:01:00.000Z"),
    });
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(1);
  });

  // What the browser does: prepare, and when it needs the producer, sign the hash and send it.
  async function activateStellar(user: (typeof users)[keyof typeof users] = users.a) {
    const prepared = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    if (prepared.body.status !== "signing") {
      return prepared;
    }
    const hash = prepared.body.hashToSign as string;
    return request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate/signature")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ hash, signature: sign(user.key, hash) })
      .expect(200);
  }

  it("activates a Testnet wallet once and completes producer onboarding", async () => {
    await createProducer();
    blindPay.nextCustomerKycStatus = "approved";
    expect((await createBlindPayCustomer()).status).toBe(200);

    const first = await activateStellar();

    expect(first.body).toMatchObject({
      status: "active",
      transactionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(stellar.buildInputs).toEqual([
      { producerAddress: users.a.address, state: unfundedState },
    ]);
    expect(stellar.submissionInputs).toEqual([
      {
        prepared: {
          transactionXdr: `xdr-${users.a.address}`,
          transactionHash: first.body.transactionHash,
        },
        producerAddress: users.a.address,
        producerSignature: sign(users.a.key, first.body.transactionHash),
      },
    ]);
    expect(blindPay.walletRegistrations).toEqual([
      {
        input: {
          customerId: "re_test_1",
          address: users.a.address,
          name: "Access Stellar wallet",
        },
        idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    ]);

    const repeated = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(repeated.body).toEqual(first.body);
    expect(stellar.buildInputs).toHaveLength(1);
    expect(stellar.submissionInputs).toHaveLength(1);
    expect(blindPay.walletRegistrations).toHaveLength(1);

    await expect(ownerPrisma.stellarAccountProvisioning.findFirst()).resolves.toMatchObject({
      network: "testnet",
      status: "ACTIVE",
      transactionHash: first.body.transactionHash,
      preparedEnvelopeXdr: null,
    });
    await expect(ownerPrisma.blindPayCustomer.findFirst()).resolves.toMatchObject({
      externalBlockchainWalletId: "bw_test_1",
    });

    const producer = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(producer.body).toMatchObject({
      onboardingStatus: "ready",
      compliance: { status: "approved" },
      stellar: { status: "active" },
    });
  });

  it("configures Stellar right after profile creation and registers the wallet only after KYC", async () => {
    await createProducer();

    const configured = await activateStellar();
    expect(configured.body).toMatchObject({ status: "active" });
    expect(stellar.buildInputs).toEqual([
      { producerAddress: users.a.address, state: unfundedState },
    ]);
    expect(blindPay.walletRegistrations).toEqual([]);

    const beforeKyc = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(beforeKyc.body).toMatchObject({
      onboardingStatus: "compliance_pending",
      compliance: { status: null },
      stellar: { status: "active" },
    });

    expect((await createBlindPayCustomer()).status).toBe(200);
    const pendingKyc = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(pendingKyc.body).toMatchObject({ status: "active" });
    expect(blindPay.walletRegistrations).toEqual([]);

    await ownerPrisma.blindPayCustomer.updateMany({ data: { kycStatus: "APPROVED" } });
    await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);

    expect(stellar.buildInputs).toHaveLength(1);
    expect(stellar.submissionInputs).toHaveLength(1);
    expect(blindPay.walletRegistrations).toHaveLength(1);

    const ready = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(ready.body).toMatchObject({ onboardingStatus: "ready" });
  });

  it("adds only the missing trustline to an account already activated at login", async () => {
    await createProducer();
    const missingUsdc: StellarAccountState = {
      accountExists: true,
      missingTrustlines: [configuredTrustlines[1]!],
    };
    stellar.states.set(users.a.address, missingUsdc);

    await activateStellar();

    expect(stellar.buildInputs).toEqual([{ producerAddress: users.a.address, state: missingUsdc }]);
    await expect(ownerPrisma.stellarAccountProvisioning.findFirst()).resolves.toMatchObject({
      status: "ACTIVE",
    });

    // A configured trustline missing from the ledger reopens an ACTIVE record.
    stellar.states.set(users.a.address, missingUsdc);
    await activateStellar();
    expect(stellar.buildInputs).toHaveLength(2);
    expect(stellar.submissionInputs).toHaveLength(2);
  });

  it("reconciles an existing account and trustlines without another Stellar transaction", async () => {
    await createProducer();
    blindPay.nextCustomerKycStatus = "approved";
    expect((await createBlindPayCustomer()).status).toBe(200);
    stellar.states.set(users.a.address, provisionedState);

    const activated = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);

    expect(activated.body).toEqual({ status: "active", transactionHash: null });
    expect(stellar.buildInputs).toEqual([]);
    expect(stellar.submissionInputs).toEqual([]);
    expect(blindPay.walletRegistrations).toHaveLength(1);
  });

  it("keeps the previous state when building the transaction fails for a moment", async () => {
    await createProducer();
    stellar.nextBuildError = new StellarProviderError("build_provisioning", true, "timeout");

    const unavailable = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(503);
    expect(unavailable.body).toMatchObject({ code: "stellar_activation_failed" });
    await expect(ownerPrisma.stellarAccountProvisioning.findFirst()).resolves.toMatchObject({
      status: "PENDING",
      failureCode: null,
    });
    const producer = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(producer.body).toMatchObject({ stellar: { status: "pending" } });

    const activated = await activateStellar();
    expect(activated.body).toMatchObject({ status: "active" });
  });

  it("records a definitive build failure and prepares again on the next call", async () => {
    await createProducer();
    stellar.nextBuildError = new StellarProviderError("build_provisioning", false, "tx_malformed");

    await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(502);
    await expect(ownerPrisma.stellarAccountProvisioning.findFirst()).resolves.toMatchObject({
      status: "FAILED",
      failureCode: "tx_malformed",
    });
    const failed = await request(app.getHttpServer())
      .get("/api/producers/me")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    expect(failed.body).toMatchObject({ stellar: { status: "failed" } });

    // "Tentar de novo" prepares again and asks for the signature.
    const retried = await activateStellar();
    expect(retried.body).toMatchObject({ status: "active" });
    expect(stellar.buildInputs).toHaveLength(2);
  });

  it("keeps a failed account failed when the retry fails for a moment", async () => {
    await createProducer();
    stellar.nextBuildError = new StellarProviderError("build_provisioning", false, "tx_malformed");
    await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(502);

    stellar.nextBuildError = new StellarProviderError("build_provisioning", true, "timeout");
    await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(503);

    await expect(ownerPrisma.stellarAccountProvisioning.findFirst()).resolves.toMatchObject({
      status: "FAILED",
      failureCode: "tx_malformed",
    });
  });

  it("asks for a new signature when the prepared producer activation went stale", async () => {
    await createProducer();
    const prepared = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(200);
    const hash = prepared.body.hashToSign as string;
    await ownerPrisma.stellarAccountProvisioning.updateMany({
      data: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const stale = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate/signature")
      .set("Authorization", `Bearer ${users.a.token}`)
      .send({ hash, signature: sign(users.a.key, hash) })
      .expect(409);
    expect(stale.body).toMatchObject({ code: "activation_signature_stale" });
    expect(stellar.submissionInputs).toEqual([]);
  });

  it("requires current Privy wallet ownership before activation", async () => {
    await createProducer();
    privy.wallets.set(users.a.privyUserId, {
      id: users.a.walletId,
      address: users.b.address,
      chainType: "stellar",
      ownerPrivyUserId: users.a.privyUserId,
    });

    const ownerMismatch = await request(app.getHttpServer())
      .post("/api/producers/onboarding/stellar/activate")
      .set("Authorization", `Bearer ${users.a.token}`)
      .expect(409);
    expect(ownerMismatch.body).toMatchObject({ code: "stellar_wallet_owner_mismatch" });
    expect(stellar.buildInputs).toEqual([]);
  });

  it("keeps the webhook database role restricted to its technical tables", async () => {
    const [role] = await webhookPrisma.$queryRaw<
      Array<{ isSuperuser: boolean; canBypassRls: boolean; isWebhookMember: boolean }>
    >`
      SELECT
        current_setting('is_superuser') = 'on' AS "isSuperuser",
        rolbypassrls AS "canBypassRls",
        pg_has_role(current_user, 'access_blindpay_webhook', 'member') AS "isWebhookMember"
      FROM pg_roles
      WHERE rolname = current_user
    `;

    expect(role).toEqual({
      isSuperuser: false,
      canBypassRls: false,
      isWebhookMember: true,
    });
    await expect(webhookPrisma.user.findMany()).rejects.toBeDefined();
  });
});
