import "reflect-metadata";

import { Prisma } from "@prisma/client";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaModule, PrismaService } from "../src";

const databaseUrl = "postgresql://test:test@localhost:5433/access_test";

describe("Prisma foundation integration", () => {
  let module: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule.forRoot(databaseUrl)],
    }).compile();
    prisma = module.get(PrismaService);
    await prisma.ping();
  });

  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany();
  });

  afterAll(async () => {
    await module.close();
  });

  it("connects and answers a constant query", async () => {
    await expect(prisma.ping()).resolves.toBeUndefined();
  });

  it("enforces the outbox deduplication key", async () => {
    const event = {
      deduplicationKey: "purchase:purchase-1:payment-confirmed:1",
      aggregateType: "purchase",
      aggregateId: "purchase-1",
      eventType: "payment.confirmed",
      payload: { purchaseId: "purchase-1" },
    } satisfies Prisma.OutboxEventCreateInput;

    await prisma.outboxEvent.create({ data: event });

    await expect(prisma.outboxEvent.create({ data: event })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});
