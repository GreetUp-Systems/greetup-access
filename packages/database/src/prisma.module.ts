import { DynamicModule, Global, Module } from "@nestjs/common";

import { PRISMA_DATABASE_URL, PRISMA_REQUIRE_RESTRICTED_ROLE } from "./prisma.constants";
import { PrismaService } from "./prisma.service";
import { TenantContextService } from "./tenant-context.service";

export interface PrismaModuleOptions {
  requireRestrictedRole?: boolean;
}

@Global()
@Module({})
export class PrismaModule {
  static forRoot(databaseUrl: string, options: PrismaModuleOptions = {}): DynamicModule {
    return {
      module: PrismaModule,
      providers: [
        {
          provide: PRISMA_DATABASE_URL,
          useValue: databaseUrl,
        },
        {
          provide: PRISMA_REQUIRE_RESTRICTED_ROLE,
          useValue: options.requireRestrictedRole ?? false,
        },
        PrismaService,
        TenantContextService,
      ],
      exports: [PrismaService, TenantContextService],
    };
  }
}
