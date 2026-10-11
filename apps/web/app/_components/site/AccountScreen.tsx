"use client";

import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Button } from "@access/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Skeleton } from "@access/ui/components/skeleton";
import { ArrowRight, ArrowUpRight, ChevronRight, LayoutGrid, LogOut, Wallet } from "lucide-react";
import Link from "next/link";

import { accountInitials, siteLinks } from "../../_lib/site/account";
import { SettingsSection } from "../SettingsSection";
import { TextSkeleton } from "../TextSkeleton";
import { useBuyerArea } from "./BuyerShell";

type Profile = "loading" | "buyer" | { producerName: string };

interface AccountProps {
  /** Null while the session is still unknown. */
  email: string | null;
  profile: Profile;
  onSignOut: () => void;
}

/**
 * Figma: Conta (SPEC-016 §6): Desktop · Conta 300:4244 and Desktop · Conta · Produtor 370:13566;
 * Mobile · Conta 300:4512 and Mobile · Conta · Produtor 391:4135. The access e-mail, the producer
 * profile with the way to the dashboard or the way to start selling, and "Sair". Until the session
 * and the producer read answer, what depends on them is an esqueleto.
 */
export function AccountScreen() {
  const { account, signOut } = useBuyerArea();
  if (account.kind === "visitor") {
    return null;
  }
  const props: AccountProps =
    account.kind === "member"
      ? { email: account.email, profile: account.profile, onSignOut: signOut }
      : { email: null, profile: "loading", onSignOut: signOut };
  return (
    <>
      <MobileAccount {...props} />
      <DesktopAccount {...props} />
    </>
  );
}

function AccountAvatar({ email, profile }: { email: string | null; profile: Profile }) {
  if (email === null || profile === "loading") {
    return <Skeleton className="size-avatar-m shrink-0 rounded-full" />;
  }
  return (
    <Avatar size="m" aria-hidden>
      <AvatarFallback>{accountInitials(email, profile)}</AvatarFallback>
    </Avatar>
  );
}

function DesktopAccount({ email, profile, onSignOut }: AccountProps) {
  return (
    <div className="hidden max-w-account-content flex-col gap-8 md:flex">
      <header className="flex flex-col gap-1">
        <h1 className="type-heading-h1 text-text-primary">Conta</h1>
        <p className="type-body-m text-text-tertiary">Sua conta de acesso ao Access.</p>
      </header>
      <div className="flex flex-col gap-8">
        <SettingsSection
          title="Conta"
          description="Você entra com um código enviado para este e-mail. Não há senha."
        >
          <div className="flex items-center gap-4">
            <AccountAvatar email={email} profile={profile} />
            {email === null ? (
              <TextSkeleton text="voce@email.com" type="type-body-l-strong" />
            ) : (
              <span className="min-w-0 truncate type-body-l-strong text-text-primary">{email}</span>
            )}
          </div>
        </SettingsSection>

        {profile === "loading" ? (
          <section aria-hidden className="flex gap-12">
            <div className="flex w-section-aside shrink-0 flex-col gap-1">
              <TextSkeleton text="Vender ingressos" type="type-heading-h4" />
              <TextSkeleton text="Use a mesma conta para vender" type="type-body-s" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-6">
              <TextSkeleton text="Monte o evento e venda por Pix." type="type-body-m" />
              <Skeleton className="flex h-control-md w-fit items-center gap-2 rounded-full px-4 type-ui-button-m">
                <span className="invisible">Começar a vender</span>
                <span className="block size-icon-sm" />
              </Skeleton>
            </div>
          </section>
        ) : profile === "buyer" ? (
          <SettingsSection
            title="Vender ingressos"
            description="Use a mesma conta para vender os ingressos dos seus eventos."
          >
            <p className="type-body-m text-text-secondary">
              Monte o evento e venda por Pix. Quem compra recebe o ingresso com QR Code.
            </p>
            <Button variant="inverse" asChild className="self-start">
              <Link href={siteLinks.sell.href}>
                Começar a vender
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </SettingsSection>
        ) : (
          <SettingsSection
            title="Perfil de produtor"
            description="Você vende ingressos com esta conta."
          >
            <p className="truncate type-body-m text-text-secondary">{profile.producerName}</p>
            <Button variant="inverse" asChild className="self-start">
              <Link href={siteLinks.dashboard.href}>
                Ir para o painel
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </SettingsSection>
        )}

        <SettingsSection
          title="Sessão"
          description="Sai deste navegador. Para entrar de novo, você recebe outro código no e-mail."
        >
          <Button
            variant="destructive"
            iconLeft={<LogOut aria-hidden />}
            onClick={onSignOut}
            className="self-start"
          >
            Sair
          </Button>
        </SettingsSection>
      </div>
    </div>
  );
}

function MobileAccount({ email, profile, onSignOut }: AccountProps) {
  const known = email !== null && profile !== "loading";
  return (
    <div className="flex flex-col gap-6 md:hidden">
      <h1 className="type-heading-h1 text-text-primary">Conta</h1>

      <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
        <AccountAvatar email={email} profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col gap-0-5">
          {!known ? (
            <>
              <TextSkeleton text="voce@email.com" type="type-body-l-strong" />
              <TextSkeleton text="Entra com código enviado" type="type-body-s" />
            </>
          ) : profile === "buyer" ? (
            <>
              <span className="truncate type-body-l-strong text-text-primary">{email}</span>
              <span className="truncate type-body-s text-text-tertiary">
                Entra com código enviado por e-mail
              </span>
            </>
          ) : (
            <>
              <span className="truncate type-body-l-strong text-text-primary">
                {profile.producerName}
              </span>
              <span className="truncate type-body-s text-text-tertiary">{email}</span>
            </>
          )}
        </div>
      </div>

      {profile === "loading" ? (
        <div aria-hidden className="flex flex-col gap-2">
          <TextSkeleton text="Vender" type="type-label-s" />
          <div className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface">
            <Item size="compact">
              <ItemMedia>
                <Skeleton className="size-icon-md rounded-sm" />
              </ItemMedia>
              <ItemContent className="gap-1">
                <TextSkeleton text="Vender ingressos" type="type-body-m-strong" height="h-4" />
                <TextSkeleton
                  text="Monte um evento e venda por Pix"
                  type="type-body-s"
                  height="h-3"
                />
              </ItemContent>
            </Item>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="type-label-s text-text-tertiary">
            {profile === "buyer" ? "Vender" : "Produtor"}
          </h2>
          <div className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface">
            <Item size="compact" asChild>
              <Link href={profile === "buyer" ? siteLinks.sell.href : siteLinks.dashboard.href}>
                <ItemMedia>{profile === "buyer" ? <Wallet /> : <LayoutGrid />}</ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {profile === "buyer" ? siteLinks.sell.label : siteLinks.dashboard.label}
                  </ItemTitle>
                  <ItemDescription>
                    {profile === "buyer" ? "Monte um evento e venda por Pix" : profile.producerName}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight aria-hidden />
                </ItemActions>
              </Link>
            </Item>
          </div>
        </section>
      )}

      <Button
        variant="destructive"
        size="l"
        iconLeft={<LogOut aria-hidden />}
        onClick={onSignOut}
        className="w-full"
      >
        Sair
      </Button>
    </div>
  );
}
