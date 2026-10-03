import { defineConfig } from "@caatinga/core";

// SPEC-006 §8. The deploy source is the Access platform account (D-24), which becomes the
// contract owner through the `${source.address}` placeholder.
export default defineConfig({
  project: "access",
  defaultNetwork: "testnet",
  buildRoot: ".",
  contracts: {
    ticket: {
      path: "./contracts/ticket",
      wasm: "./target/wasm32v1-none/release/ticket_contract.wasm",
      deployArgs: {
        owner: "${source.address}",
        // Provisional until the Access domain exists; the owner can repoint it with set_base_uri.
        base_uri: "https://access.invalid/tickets/",
      },
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
});
