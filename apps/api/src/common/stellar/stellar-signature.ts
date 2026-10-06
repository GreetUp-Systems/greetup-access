import { Keypair } from "@stellar/stellar-sdk";

const transactionHashPattern = /^[0-9a-f]{64}$/;
const signaturePattern = /^0x[0-9a-fA-F]{128}$/;
const stellarAddressPattern = /^G[A-Z2-7]{55}$/;

/**
 * Whether `signature` is the Ed25519 signature of the transaction hash by the account at
 * `address`. The browser signs with Privy's signRawHash, which answers `0x` + 64 bytes (D-28).
 */
export function isStellarHashSignature(
  transactionHash: string,
  address: string,
  signature: string,
): boolean {
  if (
    !transactionHashPattern.test(transactionHash) ||
    !stellarAddressPattern.test(address) ||
    !signaturePattern.test(signature)
  ) {
    return false;
  }
  return Keypair.fromPublicKey(address).verify(
    Buffer.from(transactionHash, "hex"),
    Buffer.from(signature.slice(2), "hex"),
  );
}
