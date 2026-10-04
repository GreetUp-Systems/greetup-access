import { randomBytes } from "node:crypto";

import { type ApiConfig } from "@access/config";

// Generated at runtime: a fixed literal would look like a leaked secret to the scanners.
export const ticketsTestConfig = {
  ticketQrSecret: randomBytes(32).toString("base64url"),
} satisfies Pick<ApiConfig, "ticketQrSecret">;
