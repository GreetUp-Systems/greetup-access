"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

import { publicEnv } from "../_lib/env";
import { SessionProvider } from "../_lib/session";

// Privy without its UI (SPEC-014 C): the e-mail and code screens are the Figma ones. The wallet is
// the Stellar one the API creates on bootstrap, so Privy never creates EVM or Solana wallets here.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={publicEnv.privyAppId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </PrivyProvider>
  );
}
