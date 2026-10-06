import { Keypair } from "@stellar/stellar-sdk";

import { isStellarHashSignature } from "./stellar-signature";

// Keys generated at runtime; the signature has the shape Privy's signRawHash answers.
const wallet = Keypair.random();
const other = Keypair.random();
const hash = "ab".repeat(32);
const sign = (key: Keypair, value: string): string =>
  `0x${key.sign(Buffer.from(value, "hex")).toString("hex")}`;

describe("isStellarHashSignature", () => {
  it("accepts the wallet's signature of the hash", () => {
    expect(isStellarHashSignature(hash, wallet.publicKey(), sign(wallet, hash))).toBe(true);
  });

  it("refuses another key, another hash and an altered signature", () => {
    expect(isStellarHashSignature(hash, wallet.publicKey(), sign(other, hash))).toBe(false);
    expect(isStellarHashSignature("cd".repeat(32), wallet.publicKey(), sign(wallet, hash))).toBe(
      false,
    );
    const altered = sign(wallet, hash).replace(/.$/, (last) => (last === "0" ? "1" : "0"));
    expect(isStellarHashSignature(hash, wallet.publicKey(), altered)).toBe(false);
  });

  it("refuses malformed input instead of throwing", () => {
    const signature = sign(wallet, hash);
    expect(isStellarHashSignature("not-hex", wallet.publicKey(), signature)).toBe(false);
    expect(isStellarHashSignature(hash, "GNOTANADDRESS", signature)).toBe(false);
    expect(isStellarHashSignature(hash, wallet.publicKey(), signature.slice(2))).toBe(false);
    expect(isStellarHashSignature(hash, wallet.publicKey(), "0x1234")).toBe(false);
  });
});
