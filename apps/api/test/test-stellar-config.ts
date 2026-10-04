import { type ApiConfig } from "@access/config";
import { Keypair } from "@stellar/stellar-sdk";

const sponsor = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));

export const stellarTestConfig = {
  stellarNetwork: "testnet",
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  stellarHorizonUrl: "https://horizon-testnet.stellar.org",
  stellarAssetCode: "USDB",
  stellarAssetIssuer: "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX",
  stellarUsdcAssetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  stellarSponsorPublicKey: sponsor.publicKey(),
  stellarSponsorSecretKey: sponsor.secret(),
  stellarTicketContractId: `C${"A".repeat(55)}`,
} satisfies Pick<
  ApiConfig,
  | "stellarNetwork"
  | "stellarRpcUrl"
  | "stellarHorizonUrl"
  | "stellarAssetCode"
  | "stellarAssetIssuer"
  | "stellarUsdcAssetIssuer"
  | "stellarSponsorPublicKey"
  | "stellarSponsorSecretKey"
  | "stellarTicketContractId"
>;
