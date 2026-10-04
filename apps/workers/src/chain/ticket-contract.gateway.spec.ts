import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Spec } from "@stellar/stellar-sdk/contract";

import { uuidToBytes } from "./ticket-contract.gateway";

const repositoryRoot = join(__dirname, "..", "..", "..", "..");
const contractsDir = join(repositoryRoot, "packages", "contracts");

// The spec embedded by Caatinga in the versioned bindings (D-25): the gateway's hand-written
// calls must keep matching it whenever the contract changes and the bindings are regenerated.
function bindingsSpec(): Spec {
  const client = readFileSync(join(contractsDir, "bindings", "ticket", "src", "client.ts"), "utf8");
  const match = /new Spec\((\[[^\]]*\])/.exec(client);
  if (match === null) {
    throw new Error("Spec entries not found in the generated bindings.");
  }
  return new Spec(JSON.parse(match[1]!) as string[]);
}

function signature(spec: Spec, name: string): string {
  const func = spec.getFunc(name);
  const inputs = func
    .inputs()
    .map((input) => `${input.name().toString()}:${input.type().switch().name}`)
    .join(",");
  const outputs = func
    .outputs()
    .map((output) => output.switch().name)
    .join(",");
  return `${inputs}->${outputs}`;
}

describe("TicketContract gateway", () => {
  it("encodes UUIDs as the contract's BytesN<16>", () => {
    expect(uuidToBytes("00112233-4455-6677-8899-aabbccddeeff")).toEqual(
      Buffer.from("00112233445566778899aabbccddeeff", "hex"),
    );
    expect(() => uuidToBytes("not-a-uuid")).toThrow("invalid_uuid");
  });

  it("calls the functions exactly as the versioned bindings describe them", () => {
    const spec = bindingsSpec();

    expect(signature(spec, "event")).toBe("event_id:scSpecTypeBytesN->scSpecTypeOption");
    expect(signature(spec, "set_event_capacity")).toBe(
      "event_id:scSpecTypeBytesN,capacity:scSpecTypeU32->scSpecTypeResult",
    );
    expect(signature(spec, "token_of")).toBe("ticket_id:scSpecTypeBytesN->scSpecTypeOption");
    expect(signature(spec, "mint")).toBe(
      "ticket_id:scSpecTypeBytesN,event_id:scSpecTypeBytesN,to:scSpecTypeAddress->scSpecTypeResult",
    );
  });

  it("points the workers at the contract recorded by Caatinga", () => {
    const artifacts = JSON.parse(
      readFileSync(join(contractsDir, "caatinga.artifacts.json"), "utf8"),
    ) as { networks: { testnet: { contracts: { ticket: { contractId: string } } } } };
    const marker = JSON.parse(
      readFileSync(join(contractsDir, "bindings", "ticket", ".caatinga-bindings.json"), "utf8"),
    ) as { contractId: string };
    const envExample = readFileSync(join(repositoryRoot, ".env.example"), "utf8");
    const configured = /^STELLAR_TICKET_CONTRACT_ID=(\S+)$/m.exec(envExample)?.[1];

    const deployed = artifacts.networks.testnet.contracts.ticket.contractId;
    expect(configured).toBe(deployed);
    expect(marker.contractId).toBe(deployed);
  });
});
