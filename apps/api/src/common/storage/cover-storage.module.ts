import { type ApiConfig } from "@access/config";
import { DynamicModule, Global, Module } from "@nestjs/common";

import { COVER_STORAGE } from "./cover-storage.types";
import { R2CoverStorage } from "./r2-cover-storage";

@Global()
@Module({})
export class CoverStorageModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: CoverStorageModule,
      providers: [
        {
          provide: COVER_STORAGE,
          useValue:
            config.coverStorage === undefined ? null : new R2CoverStorage(config.coverStorage),
        },
      ],
      exports: [COVER_STORAGE],
    };
  }
}
