import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";

import { loadApiConfig } from "@access/config";
import { PrismaClient, PrismaService, TenantContextService } from "@access/database";

import { BlindPayHttpGateway } from "../../src/common/blindpay/blindpay.gateway";
import { ProducerOnboardingRepository } from "../../src/producers/producer-onboarding.repository";
import { ProducerOnboardingService } from "../../src/producers/producer-onboarding.service";
import { ProducersRepository } from "../../src/producers/producers.repository";
import { UsersRepository } from "../../src/users/users.repository";

const callbackPath = "/blindpay-smoke/callback";
const approvalTimeoutMs = 10 * 60 * 1_000;
const webhookTimeoutMs = 90 * 1_000;
const smokePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface TermsCallback {
  server: Server;
  tosId: Promise<string>;
}

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

function selectCallbackOrigin(origins: string[]): URL {
  const origin = origins
    .map((value) => new URL(value))
    .find(
      (candidate) =>
        candidate.protocol === "http:" &&
        (candidate.hostname === "localhost" || candidate.hostname === "127.0.0.1") &&
        candidate.port.length > 0,
    );

  if (origin === undefined) {
    throw new Error(
      "BLINDPAY_ALLOWED_REDIRECT_ORIGINS must include an HTTP localhost origin with a port.",
    );
  }

  return origin;
}

async function createTermsCallback(origin: URL): Promise<TermsCallback> {
  let resolveTosId: (value: string) => void;
  let rejectTosId: (reason: Error) => void;
  const tosId = new Promise<string>((resolve, reject) => {
    resolveTosId = resolve;
    rejectTosId = reject;
  });

  const timeout = setTimeout(() => {
    rejectTosId(new Error("Timed out waiting for the BlindPay Terms of Service callback."));
  }, approvalTimeoutMs);
  timeout.unref();

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", origin);
    if (requestUrl.pathname !== callbackPath) {
      response.writeHead(404).end("Not found");
      return;
    }

    const callbackTosId = requestUrl.searchParams.get("tos_id");
    if (callbackTosId === null || callbackTosId.length === 0) {
      response.writeHead(400).end("BlindPay did not return tos_id.");
      rejectTosId(new Error("BlindPay did not return tos_id."));
      return;
    }

    clearTimeout(timeout);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><title>Access</title><h1>Termos aceitos</h1><p>O smoke test pode continuar. Esta aba pode ser fechada.</p>",
    );
    resolveTosId(callbackTosId);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(origin.port), origin.hostname, resolve);
  });

  return { server, tosId };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

async function waitForWebhook(
  prisma: PrismaClient,
  externalCustomerId: string,
  producerId: string,
): Promise<{ status: string; deliveryCount: number; outboxCount: number }> {
  const deadline = Date.now() + webhookTimeoutMs;

  while (Date.now() < deadline) {
    const [customer, deliveryCount, outboxCount] = await Promise.all([
      prisma.blindPayCustomer.findUniqueOrThrow({
        where: { externalCustomerId },
        select: { kycStatus: true },
      }),
      prisma.blindPayWebhookDelivery.count({ where: { resourceId: externalCustomerId } }),
      prisma.outboxEvent.count({
        where: { aggregateId: producerId, eventType: "producer.kyc_approved" },
      }),
    ]);

    if (customer.kycStatus !== "VERIFYING" && deliveryCount >= 1 && outboxCount === 1) {
      return {
        status: customer.kycStatus ?? "unknown",
        deliveryCount,
        outboxCount,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Timed out waiting for a BlindPay customer lifecycle webhook.");
}

async function run(): Promise<void> {
  const config = loadApiConfig();
  if (config.nodeEnv === "production") {
    throw new Error("This smoke test cannot run with NODE_ENV=production.");
  }

  const callbackOrigin = selectCallbackOrigin(config.blindPayAllowedRedirectOrigins);
  const callback = await createTermsCallback(callbackOrigin);
  const runtimePrisma = new PrismaService(config.databaseUrl, true);
  const ownerPrisma = new PrismaClient({
    datasources: { db: { url: config.databaseDirectUrl } },
  });

  try {
    await runtimePrisma.onModuleInit();

    const runId = randomUUID();
    const suffix = runId.replaceAll("-", "");
    const seeded = await ownerPrisma.user.create({
      data: {
        privyUserId: `did:privy:blindpay-smoke-${runId}`,
        email: `access.blindpay.smoke+${suffix}@example.com`,
        wallet: {
          create: {
            privyWalletId: `blindpay-smoke-wallet-${runId}`,
            stellarAddress: `G${suffix.padEnd(55, "A").slice(0, 55)}`,
          },
        },
        producerProfile: {
          create: { displayName: `Access BlindPay Smoke ${suffix.slice(0, 8)}` },
        },
      },
      include: { producerProfile: true },
    });
    if (seeded.producerProfile === null) {
      throw new Error("Failed to seed the smoke-test producer.");
    }

    const tenantContext = new TenantContextService(runtimePrisma);
    const users = new UsersRepository(runtimePrisma);
    const producers = new ProducersRepository(tenantContext);
    const onboarding = new ProducerOnboardingRepository(tenantContext);
    const blindPay = new BlindPayHttpGateway({
      apiKey: config.blindPayApiKey,
      instanceId: config.blindPayInstanceId,
      baseUrl: config.blindPayBaseUrl,
      timeoutMs: config.blindPayApiTimeoutMs,
    });
    const service = new ProducerOnboardingService(
      users,
      producers,
      onboarding,
      blindPay,
      config.blindPayAllowedRedirectOrigins,
    );
    const principal = {
      privyUserId: seeded.privyUserId,
      sessionId: `blindpay-smoke-${runId}`,
      accessToken: "manual-smoke-not-used-for-signing",
    };

    const redirectUrl = new URL(callbackPath, callbackOrigin).toString();
    const terms = await service.createTermsSession(principal, { redirectUrl });
    writeLine("BlindPay Development smoke initialized.");
    writeLine(`Open this URL and accept the Terms of Service:\n${terms.url}`);
    writeLine("Waiting for the browser callback (up to 10 minutes)...");

    const tosId = await callback.tosId;
    await closeServer(callback.server);
    writeLine("Terms accepted. Uploading development documents...");

    const [idDocument, selfie] = await Promise.all([
      service.uploadDocument(
        principal,
        {
          originalname: "access-smoke-id.png",
          mimetype: "image/png",
          size: smokePng.length,
          buffer: smokePng,
        },
        randomUUID(),
      ),
      service.uploadDocument(
        principal,
        {
          originalname: "access-smoke-selfie.png",
          mimetype: "image/png",
          size: smokePng.length,
          buffer: smokePng,
        },
        randomUUID(),
      ),
    ]);
    writeLine("Documents uploaded. Creating a development customer...");

    const customer = await service.createCustomer(
      principal,
      {
        type: "individual",
        kycType: "standard",
        tosId,
        taxId: "52998224725",
        addressLine1: "Avenida Paulista 1000",
        city: "Sao Paulo",
        stateProvinceRegion: "SP",
        country: "BR",
        postalCode: "01310100",
        phoneNumber: "+5511999999999",
        firstName: "Access",
        lastName: "Smoke",
        dateOfBirth: "1990-01-01T00:00:00.000Z",
        idDocCountry: "BR",
        idDocType: "PASSPORT",
        idDocFrontFile: idDocument.fileUrl,
        selfieFile: selfie.fileUrl,
      },
      "198.51.100.1",
      randomUUID(),
    );

    writeLine(`Customer created: ${customer.customerId} (${customer.status}).`);
    writeLine("Waiting for a real customer lifecycle webhook (up to 90 seconds)...");
    const result = await waitForWebhook(
      ownerPrisma,
      customer.customerId,
      seeded.producerProfile.id,
    );

    if (result.status !== "APPROVED" && result.status !== "APPROVED_RFI") {
      throw new Error(`BlindPay completed the customer with status ${result.status}.`);
    }
    if (result.deliveryCount < 1 || result.outboxCount !== 1) {
      throw new Error(
        `Webhook evidence is incomplete (deliveries=${result.deliveryCount}, outbox=${result.outboxCount}).`,
      );
    }

    writeLine(
      `Smoke passed: status=${result.status}, webhook deliveries=${result.deliveryCount}, approval outbox events=${result.outboxCount}.`,
    );
    writeLine("The development customer and local smoke records were retained as test evidence.");
  } finally {
    await closeServer(callback.server);
    await runtimePrisma.$disconnect();
    await ownerPrisma.$disconnect();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown smoke-test failure.";
  process.stderr.write(`BlindPay Development smoke failed: ${message}\n`);
  process.exitCode = 1;
});
