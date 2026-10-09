"use client";

import { Button } from "@access/ui/components/button";
import { Logo } from "@access/ui/components/logo";
import { Skeleton } from "@access/ui/components/skeleton";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { siteLinks } from "../../_lib/site/account";
import { useSession } from "../../_lib/session";
import { Identification } from "../identification/Identification";

interface CheckoutHeaderViewProps {
  /** The signed-in e-mail; null when signed out; undefined while the session is loading. */
  email: string | null | undefined;
  /** Opens the identification with origin "login". */
  onSignIn: () => void;
  /** Opens the signed-in buyer's tickets. */
  onAccount: () => void;
}

/**
 * Figma: the checkout's focused header on the desktop (Navegação of 150:2242): the logo and the
 * account, "Entrar" or the e-mail as a Fantasma M (SPEC-016 S20). Each step brings its own Barra
 * superior below md. While the session is loading, an esqueleto holds the account's place (Header
 * · Sessão carregando, 231:5834), sized by an invisible "Entrar" so nothing moves.
 */
export function CheckoutHeaderView({ email, onSignIn, onAccount }: CheckoutHeaderViewProps) {
  const signedIn = typeof email === "string";
  return (
    <header className="hidden h-bar border-b border-border-subtle bg-bg-canvas px-4 md:block">
      <div className="mx-auto flex h-full max-w-page-content items-center justify-between gap-3">
        <Logo />
        {email === undefined ? (
          <Skeleton className="flex h-control-md items-center rounded-full border border-transparent px-4 type-ui-button-m">
            <span className="invisible">Entrar</span>
          </Skeleton>
        ) : (
          <Button variant="ghost" onClick={signedIn ? onAccount : onSignIn}>
            {signedIn ? email : "Entrar"}
          </Button>
        )}
      </div>
    </header>
  );
}

/** The checkout's header with the session: the e-mail leads to Meus ingressos (SPEC-014 §5). */
export function CheckoutHeader() {
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
      <CheckoutHeaderView
        email={email}
        onSignIn={() => setSigningIn(true)}
        onAccount={() => router.push(siteLinks.tickets.href)}
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
