import { type ApiConfig } from "@access/config";
import { Test } from "@nestjs/testing";

import { StellarModule } from "./stellar.module";

describe("StellarModule", () => {
  it("fails closed instead of loading the local signer in production", async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          StellarModule.forRoot({
            nodeEnv: "production",
            stellarSponsorSecretKey: undefined,
          } as ApiConfig),
        ],
      }).compile(),
    ).rejects.toThrow("local Stellar signer is disabled in production");
  });
});
