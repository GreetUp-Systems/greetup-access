import { DynamicModule, Global, Module } from "@nestjs/common";

import { PRISMA_DATABASE_URL } from "./prisma.constants";
import { PrismaService } from "./prisma.service";

@Global()
@Module({})
export class PrismaModule {
  static forRoot(databaseUrl: string): DynamicModule {
    return {
      module: PrismaModule,
      providers: [
        {
          provide: PRISMA_DATABASE_URL,
          useValue: databaseUrl,
        },
        PrismaService,
      ],
      exports: [PrismaService],
    };
  }
}
