import {
  Account,
  Asset,
  Keypair,
  NotFoundError,
  type Operation,
  type Transaction,
} from "@stellar/stellar-sdk";

import { buildSponsoredProvisioningTransaction, StellarHorizonGateway } from "./stellar.gateway";
import { type StellarTrustline } from "./stellar.types";

const usdb: StellarTrustline = {
  code: "USDB",
  issuer: "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX",
};
const usdc: StellarTrustline = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

interface FakeHorizonServer {
  loadAccount: (address: string) => Promise<unknown>;
  submitTransaction: (submitted: Transaction) => Promise<{ hash: string }>;
}

describe("StellarHorizonGateway", () => {
  const sponsor = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
  const producer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
  const assets = [new Asset(usdb.code, usdb.issuer), new Asset(usdc.code, usdc.issuer)];

  function createGateway(sponsorPublicKey = sponsor.publicKey()): StellarHorizonGateway {
    return new StellarHorizonGateway({
      horizonUrl: "https://horizon-testnet.stellar.org",
      trustlines: [usdb, usdc],
      sponsorPublicKey,
      sponsorSecretKey: sponsor.secret(),
    });
  }

  function serverOf(gateway: StellarHorizonGateway): FakeHorizonServer {
    return (gateway as unknown as { server: FakeHorizonServer }).server;
  }

  it("builds the sponsored account and both trustlines with the correct sources", () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      assets,
      accountExists: false,
    });

    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      "beginSponsoringFutureReserves",
      "createAccount",
      "changeTrust",
      "changeTrust",
      "endSponsoringFutureReserves",
    ]);
    expect(transaction.operations.map((operation) => operation.source)).toEqual([
      sponsor.publicKey(),
      sponsor.publicKey(),
      producer.publicKey(),
      producer.publicKey(),
      producer.publicKey(),
    ]);
    expect(
      transaction.operations
        .filter((operation): operation is Operation.ChangeTrust => operation.type === "changeTrust")
        .map((operation) => (operation.line as Asset).getCode()),
    ).toEqual(["USDB", "USDC"]);
    expect(transaction.source).toBe(sponsor.publicKey());
  });

  it("omits account creation and adds only the missing trustline for an existing account", () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      assets: [new Asset(usdc.code, usdc.issuer)],
      accountExists: true,
    });

    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      "beginSponsoringFutureReserves",
      "changeTrust",
      "endSponsoringFutureReserves",
    ]);
  });

  it("refuses to build a transaction when nothing is missing", () => {
    expect(() =>
      buildSponsoredProvisioningTransaction({
        sponsorAccount: new Account(sponsor.publicKey(), "10"),
        producerAddress: producer.publicKey(),
        assets: [],
        accountExists: true,
      }),
    ).toThrow(expect.objectContaining({ operation: "provisioning_not_required" }));
  });

  it("reports which configured trustlines are missing from an existing account", async () => {
    const gateway = createGateway();
    serverOf(gateway).loadAccount = jest.fn().mockResolvedValue({
      balances: [
        { asset_type: "native", balance: "0" },
        { asset_type: "credit_alphanum4", asset_code: usdb.code, asset_issuer: usdb.issuer },
        { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: sponsor.publicKey() },
      ],
    });

    await expect(gateway.getAccountState(producer.publicKey())).resolves.toEqual({
      accountExists: true,
      missingTrustlines: [usdc],
    });
  });

  it("reports every configured trustline as missing for an unfunded address", async () => {
    const gateway = createGateway();
    serverOf(gateway).loadAccount = jest
      .fn()
      .mockRejectedValue(new NotFoundError("account not found", {}));

    await expect(gateway.getAccountState(producer.publicKey())).resolves.toEqual({
      accountExists: false,
      missingTrustlines: [usdb, usdc],
    });
  });

  it("refuses to build a trustline for an asset outside the configuration", async () => {
    const gateway = createGateway();
    const loadAccount = jest.fn();
    serverOf(gateway).loadAccount = loadAccount;

    await expect(
      gateway.buildProvisioningTransaction(producer.publicKey(), {
        accountExists: true,
        missingTrustlines: [{ code: "USDC", issuer: sponsor.publicKey() }],
      }),
    ).rejects.toMatchObject({ operation: "build_provisioning_unknown_asset", retryable: false });
    expect(loadAccount).not.toHaveBeenCalled();
  });

  it("fails startup when public and secret sponsor keys differ", () => {
    const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));

    expect(() => createGateway(other.publicKey())).toThrow("does not match");
  });

  it("verifies the producer signature before adding the sponsor signature", async () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      assets,
      accountExists: false,
    });
    const transactionHash = transaction.hash().toString("hex");
    const gateway = createGateway();
    serverOf(gateway).submitTransaction = jest.fn(async (submitted: Transaction) => {
      expect(submitted.signatures).toHaveLength(2);
      expect(
        producer.verify(submitted.hash(), Buffer.from(submitted.signatures[0]!.signature())),
      ).toBe(true);
      expect(
        sponsor.verify(submitted.hash(), Buffer.from(submitted.signatures[1]!.signature())),
      ).toBe(true);
      return { hash: transactionHash };
    });

    await expect(
      gateway.submitProvisioningTransaction(
        { transactionXdr: transaction.toXDR(), transactionHash },
        producer.publicKey(),
        `0x${producer.sign(transaction.hash()).toString("hex")}`,
      ),
    ).resolves.toEqual({ transactionHash });
  });

  it("rejects a signature made by a different wallet", async () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      assets,
      accountExists: false,
    });
    const gateway = createGateway();
    const attacker = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4));

    await expect(
      gateway.submitProvisioningTransaction(
        {
          transactionXdr: transaction.toXDR(),
          transactionHash: transaction.hash().toString("hex"),
        },
        producer.publicKey(),
        `0x${attacker.sign(transaction.hash()).toString("hex")}`,
      ),
    ).rejects.toMatchObject({ operation: "producer_signature_invalid", retryable: false });
  });
});
