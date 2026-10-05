"use client";

import { Button } from "@access/ui/components/button";
import { Logo } from "@access/ui/components/logo";
import { Skeleton } from "@access/ui/components/skeleton";
import { TopBar } from "@access/ui/components/top-bar";
import { User } from "lucide-react";

interface SiteHeaderProps {
  /** The signed-in e-mail; null when signed out; undefined while the session is loading. */
  email: string | null | undefined;
  /** Opens the identification with origin "login". */
  onSignIn: () => void;
  /** Opens the signed-in buyer's area (Seus ingressos, 9D). */
  onAccount: () => void;
}

/**
 * From md: Navegação (140:931 signed out, 150:2853 signed in), the logo and "Entrar" or the
 * e-mail as a Fantasma M in the size/page-content column; "Vender ingressos" is out of SPEC-014
 * (§12). Below md: Barra superior/Marca with the account action. While the session is loading,
 * an esqueleto holds the action's place (Header · Sessão carregando, 231:5834): on desktop it is
 * sized by an invisible "Entrar" with the button's border, padding and type, so nothing moves.
 */
export function SiteHeader({ email, onSignIn, onAccount }: SiteHeaderProps) {
  const signedIn = typeof email === "string";
  const known = email !== undefined;
  const open = signedIn ? onAccount : onSignIn;

  return (
    <>
      <header className="hidden h-bar border-b border-border-subtle bg-bg-canvas px-4 md:block">
        <div className="mx-auto flex h-full max-w-page-content items-center justify-between gap-3">
          <Logo />
          {known ? (
            <Button variant="ghost" onClick={open}>
              {signedIn ? email : "Entrar"}
            </Button>
          ) : (
            <Skeleton className="flex h-control-md items-center rounded-full border border-transparent px-4 type-ui-button-m">
              <span className="invisible">Entrar</span>
            </Skeleton>
          )}
        </div>
      </header>
      <TopBar
        className="md:hidden"
        type="brand"
        actions={
          known
            ? [
                {
                  label: signedIn ? "Seus ingressos" : "Entrar",
                  icon: <User />,
                  onClick: open,
                },
              ]
            : "loading"
        }
      />
    </>
  );
}
