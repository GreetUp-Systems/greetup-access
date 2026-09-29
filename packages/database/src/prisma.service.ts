import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { PRISMA_DATABASE_URL } from "./prisma.constants";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(PRISMA_DATABASE_URL) databaseUrl: string) {
    super({
      datasources: {
        db: { url: databaseUrl },
      },
    });
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
