"use client";

import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Button } from "@access/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@access/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  menuItemVariants,
} from "@access/ui/components/dropdown-menu";
import { SidebarAccountButton } from "@access/ui/components/sidebar";
import { cn } from "@access/ui/lib/utils";
import { House, LogOut, Ticket, User, X } from "lucide-react";
import Link from "next/link";

import { initials } from "../../_lib/producer/navigation";

// The account's places (SPEC-015 N3): the profile is in the system; Meus ingressos and the site's
// Início are on the public site, so going there reloads the page with the site's layout.
const profileLink = { href: "/producer/profile", label: "Perfil do produtor", icon: User };
const siteLinks = [
  { href: "/me/tickets", label: "Meus ingressos", icon: Ticket },
  { href: "/", label: "Ir para o site", icon: House },
];

interface AccountProps {
  name: string;
  email: string;
  /** Ends the Privy session and goes back to the site's Início. */
  onSignOut: () => void;
}

/**
 * Figma: Conta na barra lateral opening Menu da conta (Desktop · Painel · Menu da conta,
 * 288:11539): above the account, as wide as the sidebar, with the profile, the site's places and
 * "Sair" in groups.
 */
export function AccountMenu({ name, email, onSignOut }: AccountProps) {
  const short = initials(name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarAccountButton initials={short} name={name} email={email} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-sidebar">
        <DropdownMenuLabel>
          <Avatar aria-hidden>
            <AvatarFallback>{short}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate type-body-m-strong text-text-primary">{name}</span>
            <span className="truncate type-body-s text-text-tertiary">{email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileLink.href}>
            <profileLink.icon aria-hidden />
            {profileLink.label}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {siteLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>
              <link.icon aria-hidden />
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SheetSeparator() {
  return <div role="separator" className="mx-4 my-1 h-px shrink-0 bg-border-subtle" />;
}

/**
 * Figma: Folha · Conta (293:2785), from the avatar at the top of a phone screen: who is signed in
 * with the close button, then the same places as the desktop menu in 44-high rows, and "Sair".
 */
export function AccountSheet({
  open,
  onOpenChange,
  name,
  email,
  onSignOut,
}: AccountProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const close = () => onOpenChange(false);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-10">
        <div className="flex items-center gap-3 pt-2 pr-2 pb-3 pl-4">
          <Avatar size="m" aria-hidden>
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0-5">
            <DrawerTitle className="truncate type-body-l-strong">{name}</DrawerTitle>
            <DrawerDescription className="truncate type-body-s text-text-tertiary">
              {email}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-m" aria-label="Fechar">
              <X />
            </Button>
          </DrawerClose>
        </div>
        <SheetSeparator />
        <nav aria-label="Conta" className="flex flex-col px-2">
          {[profileLink, ...siteLinks].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className={cn(menuItemVariants({ size: "m" }))}
            >
              <link.icon aria-hidden />
              {link.label}
            </Link>
          ))}
        </nav>
        <SheetSeparator />
        <div className="flex flex-col px-2">
          <button
            type="button"
            onClick={() => {
              close();
              onSignOut();
            }}
            className={cn(menuItemVariants({ size: "m", variant: "destructive" }))}
          >
            <LogOut aria-hidden />
            Sair
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
