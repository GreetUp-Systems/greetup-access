"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "../_lib/session";
import { Identification } from "./identification/Identification";
import { SiteHeader } from "./SiteHeader";

/**
 * The header with the session: "Entrar" opens the identification with origin "login" (SPEC-014
 * §5); signed in, the e-mail leads to Seus ingressos.
 */
export function AppHeader({ mobileBar = true }: { mobileBar?: boolean }) {
  const { state } = useSession();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  const email =
    state.status === "authenticated"
      ? state.account.user.email
      : state.status === "anonymous"
        ? null
        : undefined;

  return (
    <>
      <SiteHeader
        email={email}
        onSignIn={() => setSigningIn(true)}
        onAccount={() => router.push("/me/tickets")}
        mobileBar={mobileBar}
      />
      {signingIn ? (
        <Identification
          origin="login"
          onClose={() => setSigningIn(false)}
          onDone={() => setSigningIn(false)}
        />
      ) : null}
    </>
  );
}
