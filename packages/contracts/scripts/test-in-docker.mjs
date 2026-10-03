// Runs the contract tests in a Linux container. On Windows the OpenZeppelin crates, which declare
// `cdylib`, exceed the 65,535 DLL export limit of the PE format when linked for host tests.
// Spawning docker directly (no shell) keeps paths intact under cmd, PowerShell and Git Bash.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("..", import.meta.url));

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${workspace}:/work`,
    "-v",
    "access-contracts-cargo:/usr/local/cargo/registry",
    "-v",
    "access-contracts-target:/work/target",
    "-w",
    "/work",
    "rust:1-slim",
    "cargo",
    "test",
    "--locked",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
);

process.exit(result.status ?? 1);
