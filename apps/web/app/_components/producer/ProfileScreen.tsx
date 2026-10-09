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
import { Status } from "@access/ui/components/status";
import { TopBar } from "@access/ui/components/top-bar";
import { ChevronRight, House, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { initials } from "../../_lib/producer/navigation";
import { receivingSummary } from "../../_lib/producer/receiving";
import { useProducer } from "./ProducerContext";

const receivingHref = "/producer/receiving";

/** Figma: a section of the desktop profile: its title and description beside the card. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex gap-12">
      <div className="flex w-section-aside shrink-0 flex-col gap-1">
        <h2 className="type-heading-h4 text-text-primary">{title}</h2>
        <p className="type-body-s text-text-secondary">{description}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-6">
        {children}
      </div>
    </section>
  );
}

/** Figma: Ícone, the 44 tile beside a value of the profile. */
function Tile({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex size-control-md shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-secondary [&_svg]:size-icon-md"
    >
      {children}
    </div>
  );
}

/**
 * Figma: Desktop · Perfil do produtor (300:4078) and Mobile · Perfil do produtor (300:4356): the
 * public name, read only, and the summary of Recebimento with the way to its details (SPEC-015
 * §6). On the phone it is an inner page, with back and without the tabs.
 */
export function ProfileScreen() {
  const { producer, email } = useProducer();
  const router = useRouter();
  const name = producer.displayName;
  const receiving = receivingSummary(producer);

  return (
    <>
      <TopBar
        type="navigation"
        title="Perfil do produtor"
        onBack={() => router.back()}
        className="-mx-4 -mt-2 md:hidden"
      />
      <div className="flex flex-col gap-6 pt-2 md:hidden">
        <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
          <Avatar size="m" aria-hidden>
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0-5">
            <span className="truncate type-body-l-strong text-text-primary">{name}</span>
            <span className="truncate type-body-s text-text-tertiary">{email}</span>
          </div>
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="type-label-s text-text-tertiary">Produtor</h2>
          <div className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface">
            <Item size="compact" divider>
              <ItemMedia>
                <House />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Nome público</ItemTitle>
                <ItemDescription>{name}</ItemDescription>
              </ItemContent>
            </Item>
            <Item size="compact" asChild>
              <Link href={receivingHref}>
                <ItemMedia>
                  <Wallet />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Recebimento</ItemTitle>
                  <ItemDescription>{receiving.short}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {receiving.status === null ? null : <Status status={receiving.status} />}
                  <ChevronRight aria-hidden />
                </ItemActions>
              </Link>
            </Item>
          </div>
        </section>
      </div>

      <div className="hidden flex-col gap-8 md:flex">
        <header className="flex flex-col gap-1">
          <h1 className="type-heading-h1 text-text-primary">Perfil do produtor</h1>
          <p className="type-body-m text-text-tertiary">
            O nome que aparece para quem compra e para onde vai o dinheiro das vendas.
          </p>
        </header>
        <Section title="Perfil de produtor" description="Como você aparece para quem compra.">
          <div className="flex items-center gap-4">
            <Tile>
              <House />
            </Tile>
            <div className="flex min-w-0 flex-col gap-0-5">
              <span className="type-body-s text-text-tertiary">Nome público</span>
              <span className="truncate type-body-l-strong text-text-primary">{name}</span>
            </div>
          </div>
          <p className="type-body-s text-text-secondary">
            Aparece como “Organizado por {name}” na página de cada evento.
          </p>
        </Section>
        <Section
          title="Recebimento"
          description="Para onde vai o dinheiro das vendas. A verificação é feita pela BlindPay."
        >
          <div className="flex items-center gap-4">
            <Tile>
              <Wallet />
            </Tile>
            <div className="flex min-w-0 flex-1 flex-col gap-0-5">
              <span className="flex items-center gap-2">
                <span className="type-body-l-strong text-text-primary">Conta de recebimento</span>
                {receiving.status === null ? null : <Status status={receiving.status} />}
              </span>
              <span className="type-body-s text-text-tertiary">{receiving.detail}</span>
            </div>
            <Button asChild variant="secondary">
              <Link href={receivingHref}>
                Ver detalhes
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </Section>
      </div>
    </>
  );
}
