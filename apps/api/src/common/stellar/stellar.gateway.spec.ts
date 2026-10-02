import { Account, Asset, Keypair, type Transaction } from "@stellar/stellar-sdk";

import {
  buildSponsoredProvisioningTransaction,
  StellarHorizonGateway,
} from "./stellar.gateway";

const issuer = "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX";

describe("StellarHorizonGateway", () => {
  const sponsor = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
  const producer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
  const asset = new Asset("USDB", issuer);

  it("builds the four sponsored operations with the correct sources", () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      asset,
      accountExists: false,
    });

    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      "beginSponsoringFutureReserves",
      "createAccount",
      "changeTrust",
      "endSponsoringFutureReserves",
    ]);
    expect(transaction.operations.map((operation) => operation.source)).toEqual([
      sponsor.publicKey(),
      sponsor.publicKey(),
      producer.publicKey(),
      producer.publicKey(),
    ]);
    expect(transaction.source).toBe(sponsor.publicKey());
  });

  it("omits account creation when reconciling an existing account", () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      asset,
      accountExists: true,
    });

    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      "beginSponsoringFutureReserves",
      "changeTrust",
      "endSponsoringFutureReserves",
    ]);
  });

  it("fails startup when public and secret sponsor keys differ", () => {
    const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));

    expect(
      () =>
        new StellarHorizonGateway({
          horizonUrl: "https://horizon-testnet.stellar.org",
          assetCode: "USDB",
          assetIssuer: issuer,
          sponsorPublicKey: other.publicKey(),
          sponsorSecretKey: sponsor.secret(),
        }),
    ).toThrow("does not match");
  });

  it("verifies the producer signature before adding the sponsor signature", async () => {
    const transaction = buildSponsoredProvisioningTransaction({
      sponsorAccount: new Account(sponsor.publicKey(), "10"),
      producerAddress: producer.publicKey(),
      asset,
      accountExists: false,
    });
    const transactionHash = transaction.hash().toString("hex");
    const gateway = new StellarHorizonGateway({
      horizonUrl: "https://horizon-testnet.stellar.org",
      assetCode: "USDB",
      assetIssuer: issuer,
      sponsorPublicKey: sponsor.publicKey(),
      sponsorSecretKey: sponsor.secret(),
    });
    const server = (
      gateway as unknown as {
        server: { submitTransaction: (submitted: Transaction) => Promise<{ hash: string }> };
      }
    ).server;
    server.submitTransaction = jest.fn(async (submitted: Transaction) => {
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
      asset,
      accountExists: false,
    });
    const gateway = new StellarHorizonGateway({
      horizonUrl: "https://horizon-testnet.stellar.org",
      assetCode: "USDB",
      assetIssuer: issuer,
      sponsorPublicKey: sponsor.publicKey(),
      sponsorSecretKey: sponsor.secret(),
    });
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
