import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { PRISMA_DATABASE_URL, PRISMA_REQUIRE_RESTRICTED_ROLE } from "./prisma.constants";

interface RuntimeRoleState {
  roleName: string;
  isSuperuser: boolean;
  canBypassRls: boolean;
  isRuntimeMember: boolean;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy, OnModuleInit {
  constructor(
    @Inject(PRISMA_DATABASE_URL) databaseUrl: string,
    @Inject(PRISMA_REQUIRE_RESTRICTED_ROLE) private readonly requireRestrictedRole: boolean,
  ) {
    super({
      datasources: {
        db: { url: databaseUrl },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.requireRestrictedRole) {
      await this.assertRestrictedRuntimeRole();
    }
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async assertRestrictedRuntimeRole(): Promise<void> {
    const [role] = await this.$queryRaw<RuntimeRoleState[]>`
      SELECT
        current_user AS "roleName",
        current_setting('is_superuser') = 'on' AS "isSuperuser",
        rolbypassrls AS "canBypassRls",
        pg_has_role(current_user, 'access_app_runtime', 'member') AS "isRuntimeMember"
      FROM pg_roles
      WHERE rolname = current_user
    `;

    if (role === undefined || role.isSuperuser || role.canBypassRls || !role.isRuntimeMember) {
      throw new Error("DATABASE_URL must use the restricted Access runtime role.");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
