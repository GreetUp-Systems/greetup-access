"use client";

import { Button } from "@access/ui/components/button";
import { Logo } from "@access/ui/components/logo";
import { Skeleton } from "@access/ui/components/skeleton";
import { LayoutGrid, Ticket } from "lucide-react";
import Link from "next/link";

import { type SiteAccount, siteLinks } from "../../_lib/site/account";
import { SiteAccountMenu } from "./SiteAccountMenu";

interface SiteHeaderProps {
  account: SiteAccount;
  /** Opens the identification with origin "login"; the person stays on the page (S17). */
  onSignIn: () => void;
  onSignOut: () => void;
}

/**
 * Figma: Cabeçalho do site (316:171), on the desktop of the public pages, in its 16A state: without
 * the search and "Para produtores" (S5). The logo leads to the Início; on the right, "Entrar" for a
 * visitor, "Meus ingressos" and the avatar for a buyer, and also "Painel do produtor" for a
 * producer (S2). While the session or the producer is unknown, an esqueleto holds the place of the
 * right group's last button (Header · Sessão carregando, 231:5834): the group grows to the left, so
 * nothing moves when it arrives.
 */
export function SiteHeader({ account, onSignIn, onSignOut }: SiteHeaderProps) {
  return (
    <header className="hidden h-bar border-b border-border-subtle bg-bg-canvas px-4 md:block">
      <div className="mx-auto flex h-full max-w-page-content items-center gap-4">
        <Link
          href="/"
          className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent"
        >
          <Logo />
        </Link>
        <span className="flex-1" />
        <Account account={account} onSignIn={onSignIn} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

function AccountSkeleton() {
  return (
    <Skeleton className="flex h-control-md items-center rounded-full border border-transparent px-4 type-ui-button-m">
      <span className="invisible">Entrar</span>
    </Skeleton>
  );
}

function Account({ account, onSignIn, onSignOut }: SiteHeaderProps) {
  if (account.kind === "loading") {
    return <AccountSkeleton />;
  }
  if (account.kind === "visitor") {
    return (
      <Button variant="inverse" onClick={onSignIn}>
        Entrar
      </Button>
    );
  }
  const { email, profile } = account;
  if (profile === "loading") {
    return <AccountSkeleton />;
  }
  return (
    <>
      <Button variant="ghost" asChild>
        <Link href={siteLinks.tickets.href}>
          <Ticket aria-hidden />
          {siteLinks.tickets.label}
        </Link>
      </Button>
      {profile === "buyer" ? null : (
        <Button variant="secondary" asChild>
          <Link href={siteLinks.dashboard.href}>
            <LayoutGrid aria-hidden />
            {siteLinks.dashboard.label}
          </Link>
        </Button>
      )}
      <SiteAccountMenu email={email} profile={profile} onSignOut={onSignOut} />
    </>
  );
}
