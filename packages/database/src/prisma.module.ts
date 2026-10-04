import { DynamicModule, Global, Module } from "@nestjs/common";

import {
  PRISMA_DATABASE_URL,
  PRISMA_REQUIRE_RESTRICTED_ROLE,
  PRISMA_RESTRICTED_ROLE,
} from "./prisma.constants";
import { PrismaService } from "./prisma.service";
import { TenantContextService } from "./tenant-context.service";

export interface PrismaModuleOptions {
  requireRestrictedRole?: boolean;
  /** Role the connection must belong to when restricted; defaults to the API runtime role. */
  restrictedRole?: "access_app_runtime" | "access_worker";
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
        {
          provide: PRISMA_RESTRICTED_ROLE,
          useValue: options.restrictedRole ?? "access_app_runtime",
        },
        PrismaService,
        TenantContextService,
      ],
      exports: [PrismaService, TenantContextService],
    };
  }
}
