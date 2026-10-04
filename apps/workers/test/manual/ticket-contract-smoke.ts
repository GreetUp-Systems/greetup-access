// Manual Testnet smoke for the TicketContract gateway (SPEC-005 §11).
// Run from apps/workers: pnpm exec dotenv -e ../../.env -- tsx test/manual/ticket-contract-smoke.ts
import { randomUUID } from "node:crypto";

import { loadWorkerConfig } from "@access/config";
import { Keypair, Networks } from "@stellar/stellar-sdk";

import { SorobanTicketContractGateway } from "../../src/chain/ticket-contract.gateway";

function report(message: string, value?: unknown): void {
  process.stdout.write(`${message}${value === undefined ? "" : ` ${JSON.stringify(value)}`}
`);
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  if (config.stellarSponsorSecretKey === undefined) {
    throw new Error("The smoke needs the local Testnet signer.");
  }
  const gateway = new SorobanTicketContractGateway({
    contractId: config.stellarTicketContractId,
    rpcUrl: config.stellarRpcUrl,
    networkPassphrase: Networks.TESTNET,
    signerSecretKey: config.stellarSponsorSecretKey,
  });

  const eventId = randomUUID();
  const ticketId = randomUUID();
  // A never-funded address: the mint must not require an active account (D-23).
  const buyer = Keypair.random().publicKey();

  const missing = await gateway.event(eventId);
  report("event before capacity:", missing);
  await gateway.setEventCapacity(eventId, 2);
  report("event after capacity:", await gateway.event(eventId));

  const first = await gateway.mint(ticketId, eventId, buyer);
  report("first mint:", first);
  const repeated = await gateway.mint(ticketId, eventId, buyer);
  report("repeated mint:", repeated);

  const after = await gateway.event(eventId);
  if (
    missing !== null ||
    first.transactionHash === null ||
    repeated.tokenId !== first.tokenId ||
    repeated.transactionHash !== null ||
    after?.minted !== 1
  ) {
    throw new Error("Unexpected smoke result.");
  }
  report("smoke ok");
}

void main().catch((error: unknown) => {
  report(error instanceof Error ? `${error.name}: ${error.message}` : "smoke failed");
  process.exitCode = 1;
});
