"use client";

import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Button } from "@access/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@access/ui/components/dropdown-menu";
import { ArrowUpRight, LayoutGrid, LogOut, type LucideIcon, Ticket, User } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { accountInitials, accountMenuGroups, siteLinks } from "../../_lib/site/account";

type Profile = "buyer" | { producerName: string };

const icons: Record<string, LucideIcon> = {
  [siteLinks.tickets.href]: Ticket,
  [siteLinks.account.href]: User,
  [siteLinks.sell.href]: ArrowUpRight,
  [siteLinks.dashboard.href]: LayoutGrid,
};

interface SiteAccountMenuProps {
  email: string;
  profile: Profile;
  onSignOut: () => void;
}

/**
 * Figma: Menu da conta, Contexto = Site (365:246 for a buyer, 365:260 for a producer). A buyer is
 * shown by the initial and the e-mail; a producer, by the initials, the public name and the e-mail
 * (S3). Then Meus ingressos and Conta, Vender ingressos or Painel do produtor, and "Sair".
 */
export function SiteAccountMenuContent({
  email,
  profile,
  onSignOut,
  align = "end",
}: SiteAccountMenuProps & { align?: "start" | "end" }) {
  return (
    <DropdownMenuContent align={align} className="w-sidebar">
      <DropdownMenuLabel>
        <Avatar aria-hidden>
          <AvatarFallback>{accountInitials(email, profile)}</AvatarFallback>
        </Avatar>
        {profile === "buyer" ? (
          <span className="min-w-0 truncate type-body-m-strong text-text-primary">{email}</span>
        ) : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate type-body-m-strong text-text-primary">
              {profile.producerName}
            </span>
            <span className="truncate type-body-s text-text-tertiary">{email}</span>
          </span>
        )}
      </DropdownMenuLabel>
      {accountMenuGroups(profile).map((group) => (
        <Fragment key={group[0]?.href}>
          <DropdownMenuSeparator />
          {group.map((link) => {
            const Icon = icons[link.href] ?? User;
            return (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>
                  <Icon aria-hidden />
                  {link.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </Fragment>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
        <LogOut aria-hidden />
        Sair
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

/**
 * The avatar at the end of the Cabeçalho do site (316:57, 316:110): Avatar S in a 44 touch target
 * that opens the account menu below it, aligned to its right edge.
 */
export function SiteAccountMenu({ email, profile, onSignOut }: SiteAccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-m" aria-label="Menu da conta">
          <Avatar aria-hidden>
            <AvatarFallback>{accountInitials(email, profile)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <SiteAccountMenuContent email={email} profile={profile} onSignOut={onSignOut} />
    </DropdownMenu>
  );
}
