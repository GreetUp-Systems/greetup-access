"use client";

import { type TopBarAction, TopBar } from "@access/ui/components/top-bar";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { siteLinks } from "../../_lib/site/account";
import { Identification } from "../identification/Identification";
import { SiteHeader } from "../site/SiteHeader";
import { useSiteAccount } from "../site/useSiteAccount";

/**
 * The event page's header (SPEC-016 S12, S19): the Cabeçalho do site on the desktop; on the phone
 * the Barra superior/Marca over the poster, whose account action is "Conta" (to /me) when signed in
 * and "Entrar" otherwise. "Entrar" opens the identification with origin "login", and the person
 * stays on the page (S17).
 */
export function EventHeader() {
  const { account, signOut } = useSiteAccount();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const signIn = (): void => setSigningIn(true);

  let actions: readonly [TopBarAction] | "loading" = "loading";
  if (account.kind === "visitor") {
    actions = [{ label: "Entrar", icon: <User />, onClick: signIn }];
  } else if (account.kind === "member") {
    actions = [
      {
        label: siteLinks.account.label,
        icon: <User />,
        onClick: () => router.push(siteLinks.account.href),
      },
    ];
  }

  return (
    <>
      <SiteHeader account={account} onSignIn={signIn} onSignOut={signOut} />
      <TopBar className="md:hidden" type="brand" actions={actions} />
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
