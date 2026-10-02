import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@access/database";

@Injectable()
export class BlindPayWebhookPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(databaseUrl: string) {
    super({ datasources: { db: { url: databaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    const [role] = await this.$queryRaw<
      Array<{ isSuperuser: boolean; canBypassRls: boolean; isWebhookMember: boolean }>
    >`
      SELECT
        current_setting('is_superuser') = 'on' AS "isSuperuser",
        rolbypassrls AS "canBypassRls",
        pg_has_role(current_user, 'access_blindpay_webhook', 'member') AS "isWebhookMember"
      FROM pg_roles
      WHERE rolname = current_user
    `;

    if (role === undefined || role.isSuperuser || role.canBypassRls || !role.isWebhookMember) {
      throw new Error("DATABASE_URL_BLINDPAY_WEBHOOK must use the restricted webhook role.");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
