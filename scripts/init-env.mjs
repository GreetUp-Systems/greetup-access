import { constants } from "node:fs";
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const exampleUrl = new URL("../.env.example", import.meta.url);
const destinationUrl = new URL("../.env", import.meta.url);

try {
  await copyFile(fileURLToPath(exampleUrl), fileURLToPath(destinationUrl), constants.COPYFILE_EXCL);
  process.stdout.write("Created .env from .env.example.\n");
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    process.stdout.write(".env already exists; nothing changed.\n");
  } else {
    throw error;
  }
}
