"use client";

import { ActionBar } from "@access/ui/components/action-bar";
import { Button } from "@access/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@access/ui/components/drawer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@access/ui/components/input-group";
import { Progress } from "@access/ui/components/progress";
import { Status, type StatusState } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";
import { Check, CircleCheck, Clock, Copy, Link as LinkIcon, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import type { EventDetail } from "../../../_lib/api/producer-events";
import { formatPrice } from "../../../_lib/format";
import { editHref, publicEventPath } from "../../../_lib/producer/event-flow";
import { soldPercent } from "../../../_lib/producer/events";
import {
  pendingRequirements,
  pendingSummary,
  publicationTitle,
  publishBlockReason,
  receivingHref,
  type Requirement,
} from "../../../_lib/producer/publication";
import { useEventFlow } from "./EventFlowProvider";
import { ConnectionNotice } from "./EventFrame";

/** The warning of the publication (SPEC-015 §6), when nothing is missing. */
const publishWarning =
  "Publicado, o evento não volta a ser rascunho e os tipos de ingresso não podem mais ser apagados.";

const requirementIcons = {
  done: <CircleCheck aria-hidden className="size-icon-md shrink-0 text-icon-success" />,
  waiting: <Clock aria-hidden className="size-icon-md shrink-0 text-icon-secondary" />,
  missing: <TriangleAlert aria-hidden className="size-icon-md shrink-0 text-icon-warning" />,
} as const;

/**
 * Figma: Requisitos of the Publicação card (595:13914) and of the sheet (595:13523): done (check),
 * waiting on someone else (clock, the line in text/secondary) or missing (alert, the detail in
 * text/warning), and the action that solves it: the Recebimento, or the event's section.
 */
function RequirementList({
  requirements,
  eventId,
  onAction,
}: {
  requirements: readonly Requirement[];
  eventId: string;
  onAction?: () => void;
}) {
  const flow = useEventFlow();
  return (
    <ul aria-label="Requisitos para publicar" className="flex flex-col gap-3">
      {requirements.map((requirement) => {
        const href =
          requirement.action === null
            ? null
            : requirement.action.target.kind === "receiving"
              ? receivingHref
              : editHref(eventId, requirement.action.target.section);
        return (
          <li
            key={requirement.key}
            className={cn("flex gap-3", href === null ? "items-start" : "items-center")}
          >
            {requirementIcons[requirement.state]}
            <div className="flex min-w-0 flex-1 flex-col gap-0-5">
              <p
                className={cn(
                  "type-body-m",
                  requirement.state === "waiting" ? "text-text-secondary" : "text-text-primary",
                )}
              >
                {requirement.title}
                <span className="sr-only">
                  {requirement.state === "done" ? " (cumprido)" : " (pendente)"}
                </span>
              </p>
              {requirement.detail === null ? null : (
                <p
                  className={cn(
                    "type-body-s",
                    requirement.state === "missing" ? "text-text-warning" : "text-text-tertiary",
                  )}
                >
                  {requirement.detail}
                </p>
              )}
            </div>
            {href === null || requirement.action === null ? null : (
              <Button asChild variant="ghost" size="s">
                <Link
                  href={href}
                  onClick={() => {
                    if (href !== receivingHref) {
                      flow.reachForward(href);
                    }
                    onAction?.();
                  }}
                >
                  {requirement.action.label}
                </Link>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface PublishingProps {
  event: EventDetail;
  requirements: readonly Requirement[];
  publishing: boolean;
  /** The toast of a publication that did not go, with "Tentar de novo". */
  failed: boolean;
  onPublish: () => void;
}

/** The line under the button: why it is disabled, or the warning of the publication. */
function PublishNote({
  requirements,
  centered = false,
}: {
  requirements: readonly Requirement[];
  centered?: boolean;
}) {
  const reason = publishBlockReason(requirements);
  return (
    <p
      className={cn(
        "type-body-s",
        reason === null ? "text-text-tertiary" : "text-text-secondary",
        centered && reason !== null && "text-center",
      )}
    >
      {reason ?? publishWarning}
    </p>
  );
}

/**
 * Desktop: the Publicação card beside the summary (591:12579; Publicar bloqueado 595:13914): the
 * requirements, "Publicar evento" (Botão/Inverso M) and the reason it is disabled, or the warning.
 */
export function PublicationCard({
  event,
  requirements,
  publishing,
  failed,
  onPublish,
}: PublishingProps) {
  const blocked = pendingRequirements(requirements).length > 0;
  return (
    <section
      aria-labelledby="publication-title"
      className="flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="publication-title" className="type-heading-h4 text-text-primary">
          Publicação
        </h2>
        <p className="type-body-s text-text-tertiary">
          {blocked
            ? `${publicationTitle(requirements)}.`
            : "Tudo pronto: o evento pode ir para o ar."}
        </p>
      </div>
      {failed ? <ConnectionNotice onRetry={onPublish} retrying={publishing} /> : null}
      <RequirementList requirements={requirements} eventId={event.id} />
      <div className="flex flex-col gap-3">
        <Button
          variant="inverse"
          size="m"
          className="w-full"
          disabled={blocked}
          loading={publishing}
          onClick={onPublish}
        >
          Publicar evento
        </Button>
        <PublishNote requirements={requirements} />
      </div>
    </section>
  );
}

/** Phone: the card above the summary (591:12345; blocked 595:13689): what is missing, at a glance. */
export function PublicationHeader({
  requirements,
  status,
}: {
  requirements: readonly Requirement[];
  status: StatusState;
}) {
  return (
    <section
      aria-labelledby="publication-header"
      className="flex flex-col gap-0-5 rounded-xl border border-border-subtle bg-bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <h2 id="publication-header" className="min-w-0 flex-1 type-body-m-strong text-text-primary">
          {publicationTitle(requirements)}
        </h2>
        <Status status={status} size="m" />
      </div>
      <p className="type-body-s text-text-secondary">{pendingSummary(requirements)}</p>
    </section>
  );
}

/**
 * Phone: Publicar evento (595:13523; blocked 595:13689), the sheet the bottom bar opens: what the
 * publication does or what is missing, the requirements, and the action in its Barra de ações.
 */
export function PublishSheet({
  open,
  onOpenChange,
  event,
  requirements,
  publishing,
  failed,
  onPublish,
}: PublishingProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const blocked = pendingRequirements(requirements).length > 0;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-0 bg-bg-surface shadow-none backdrop-blur-none md:hidden">
        <DrawerHeader className="pr-2 pb-2">
          <DrawerTitle className="min-w-0 flex-1 type-heading-h4">Publicar evento</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-m" aria-label="Fechar">
              <X />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2">
          <DrawerDescription>
            {blocked
              ? "Resolva o que falta para publicar."
              : "Ao publicar, o evento entra na vitrine e as vendas abrem."}
          </DrawerDescription>
          {failed ? <ConnectionNotice onRetry={onPublish} retrying={publishing} /> : null}
          <RequirementList
            requirements={requirements}
            eventId={event.id}
            onAction={() => onOpenChange(false)}
          />
          <PublishNote requirements={requirements} centered />
        </div>
        <div className="px-4 pt-3 pb-2">
          <ActionBar>
            <Button
              variant="inverse"
              size="m"
              disabled={blocked}
              loading={publishing}
              onClick={onPublish}
            >
              Publicar evento
            </Button>
          </ActionBar>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** "Copiar link", which says "Link copiado" for a moment (as the event's row menu, 410:16610). */
export function useCopyLink(url: string) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = (): void => {
    void navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };
  return { copied, copy };
}

/** The public page's address: shown without the scheme, copied whole (SPEC-015 §6). */
export function publicLink(slug: string): { shown: string; url: string } {
  const path = publicEventPath(slug);
  if (typeof window === "undefined") {
    return { shown: path, url: path };
  }
  return { shown: `${window.location.host}${path}`, url: `${window.location.origin}${path}` };
}

/** The sold tickets over the capacity and the revenue (Vendas, 592:12678 and 592:12539). */
function SalesNumbers({
  soldTickets,
  salesCents,
  capacity,
}: {
  soldTickets: number;
  salesCents: number;
  capacity: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2">
          <span className="min-w-0 flex-1 type-body-s text-text-secondary">Vendidos</span>
          <span className="type-body-m-strong whitespace-nowrap text-text-primary">
            {soldTickets} de {capacity}
          </span>
        </p>
        <Progress value={soldPercent({ soldTickets, capacity })} aria-label="Vendidos" />
      </div>
      <p className="flex items-center gap-2">
        <span className="min-w-0 flex-1 type-body-s text-text-secondary">Receita</span>
        <span className="type-mono-m whitespace-nowrap text-text-primary">
          {formatPrice(salesCents)}
        </span>
      </p>
    </>
  );
}

export interface Sales {
  soldTickets: number;
  salesCents: number;
}

/**
 * Desktop: the published event's cards beside the summary (592:12678): À venda, with the public
 * page's link and "Copiar link", and Vendas.
 */
export function PublishedCards({ event, sales }: { event: EventDetail; sales: Sales }) {
  const link = publicLink(event.slug);
  const { copied, copy } = useCopyLink(link.url);
  return (
    <>
      <section
        aria-labelledby="on-sale-title"
        className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="on-sale-title" className="type-heading-h4 text-text-primary">
            À venda
          </h2>
          <p className="type-body-s text-text-tertiary">
            A página do evento está no ar. Compartilhe o link.
          </p>
        </div>
        <InputGroup size="m">
          <InputGroupAddon>
            <LinkIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput readOnly aria-label="Link do evento" value={link.shown} />
        </InputGroup>
        <Button
          variant="secondary"
          size="m"
          className="w-full"
          iconLeft={copied ? <Check /> : <Copy />}
          onClick={copy}
        >
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
      </section>
      <section
        aria-labelledby="sales-title"
        className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6"
      >
        <h2 id="sales-title" className="type-heading-h4 text-text-primary">
          Vendas
        </h2>
        <SalesNumbers {...sales} capacity={event.capacity} />
      </section>
    </>
  );
}

/** Phone: À venda above the summary (592:12539): the Status and the sales. */
export function OnSaleHeader({
  event,
  sales,
  status,
}: {
  event: EventDetail;
  sales: Sales;
  status: StatusState;
}) {
  return (
    <section
      aria-labelledby="on-sale-header"
      className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <h2 id="on-sale-header" className="min-w-0 flex-1 type-body-m-strong text-text-primary">
          À venda
        </h2>
        <Status status={status} size="m" />
      </div>
      <SalesNumbers {...sales} capacity={event.capacity} />
    </section>
  );
}

/** Phone: the Barra de ações of the published event: "Ver página" and "Copiar link". */
export function PublishedActions({ event }: { event: EventDetail }) {
  const link = publicLink(event.slug);
  const { copied, copy } = useCopyLink(link.url);
  return (
    <BottomBar>
      <Button asChild variant="secondary" size="m">
        <a href={publicEventPath(event.slug)} target="_blank" rel="noreferrer">
          Ver página
        </a>
      </Button>
      <Button variant="inverse" size="m" onClick={copy}>
        {copied ? "Link copiado" : "Copiar link"}
      </Button>
    </BottomBar>
  );
}

/** The Barra de ações fixed at the bottom of the phone's event page (591:12345, 592:12539). */
export function BottomBar({ children }: { children: ReactNode }) {
  return <ActionBar className="fixed inset-x-4 bottom-4 z-20 md:hidden">{children}</ActionBar>;
}
