"use client";

import { Button } from "@access/ui/components/button";
import { EventThumbnail } from "@access/ui/components/event-cover";
import { Progress } from "@access/ui/components/progress";
import { Skeleton } from "@access/ui/components/skeleton";
import { Step, Steps } from "@access/ui/components/step";
import { cn } from "@access/ui/lib/utils";
import { Calendar, Check, Clock, ExternalLink, Link as LinkIcon, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import type { ProducerEvent, RecentSale } from "../../_lib/api/producer";
import {
  formatAmount,
  formatDaysUntil,
  formatTicketDateTime,
  formatTimeAgo,
} from "../../_lib/format";
import type { SetupStep } from "../../_lib/producer/dashboard";
import { soldPercent } from "../../_lib/producer/events";

const receivingHref = "/producer/receiving";

function Card({
  label,
  className,
  children,
}: {
  label: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Figma: Próximo evento (284:1571): the published event that starts next, how far it is, sold over
 * capacity, and its link to copy or open. Copiar link turns into "Link copiado" (410:16610).
 */
export function NextEventCard({
  event,
  now,
  className,
}: {
  event: ProducerEvent | null;
  now: Date;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Card label="Próximo evento" className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-heading-h4 text-text-primary">Próximo evento</h2>
        {event === null ? null : (
          <span className="inline-flex h-status-s shrink-0 items-center gap-1 rounded-full bg-bg-subtle px-2 type-badge-s text-text-secondary">
            <Clock aria-hidden className="size-icon-xs text-icon-secondary" />
            {formatDaysUntil(event.startsAt, now)}
          </span>
        )}
      </div>
      {event === null ? (
        <p className="type-body-m text-text-secondary">Nenhum evento à venda ainda.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <EventThumbnail src={event.coverUrl} className="md:size-thumbnail-s" />
            <div className="flex min-w-0 flex-col gap-0-5">
              <span className="truncate type-body-l-strong text-text-primary">{event.name}</span>
              <span className="truncate type-body-s text-text-tertiary">
                {[formatTicketDateTime(event.startsAt), event.venueName]
                  .filter((part) => part !== null && part !== "")
                  .join(" · ")}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="type-body-s text-text-secondary">Vendidos</span>
              <span className="type-body-s text-text-secondary">
                <span className="type-body-m-strong text-text-primary">{event.soldTickets}</span> de{" "}
                {event.capacity}
              </span>
            </div>
            <Progress value={soldPercent(event)} aria-label="Vendidos" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="s"
              iconLeft={copied ? <Check aria-hidden /> : <LinkIcon aria-hidden />}
              onClick={() => {
                void navigator.clipboard
                  .writeText(`${window.location.origin}/e/${event.slug}`)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            <Button asChild variant="ghost" size="s">
              <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer">
                Ver página
                <ExternalLink aria-hidden />
              </a>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Figma: Vendas recentes (284:1571): the last confirmed sales, with the ticket type, the event, the
 * subtotal and how long ago, without anything about who bought (RN-010, N6).
 */
export function RecentSalesCard({
  sales,
  now,
  className,
}: {
  /** Null while they load. */
  sales: RecentSale[] | null;
  now: Date;
  className?: string;
}) {
  return (
    <Card label="Vendas recentes" className={className}>
      <h2 className="type-heading-h4 text-text-primary">Vendas recentes</h2>
      {sales !== null && sales.length === 0 ? (
        <p className="type-body-m text-text-secondary">Nenhuma venda ainda.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {(sales ?? [null, null, null]).map((sale, index) => (
            <li
              key={sale === null ? index : `${sale.confirmedAt}-${index}`}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className="flex size-control-sm shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-accent [&_svg]:size-icon-sm"
              >
                <Ticket />
              </span>
              {sale === null ? (
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-fit rounded-sm">
                    <span className="invisible type-body-m-strong">2 × Pista</span>
                  </Skeleton>
                  <Skeleton className="h-3 w-fit rounded-sm">
                    <span className="invisible type-body-s">Festival de Inverno</span>
                  </Skeleton>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col gap-0-5">
                    <span className="truncate type-body-m-strong text-text-primary">
                      {sale.quantity} × {sale.ticketTypeName}
                    </span>
                    <span className="truncate type-body-s text-text-tertiary">
                      {sale.eventName}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0-5">
                    <span className="type-mono-m text-text-primary">
                      <span className="text-text-tertiary">R$</span>{" "}
                      {formatAmount(sale.subtotalCents)}
                    </span>
                    <span className="type-body-s text-text-tertiary">
                      {formatTimeAgo(sale.confirmedAt, now)}
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Figma: Configuração (Configuração pendente, 298:3589 and 298:4040): what is left before selling,
 * as the Recebimento steps; the current one leads there.
 */
export function SetupCard({ steps, className }: { steps: SetupStep[]; className?: string }) {
  const done = steps.filter((step) => step.state === "done").length;
  return (
    <Card label="Configuração" className={cn("gap-5", className)}>
      <div className="flex flex-col gap-2">
        <h2 className="type-heading-h4 text-text-primary md:type-heading-h3">
          Termine a configuração para vender
        </h2>
        <p className="type-body-s text-text-secondary md:type-body-m">
          Você já pode montar eventos. Publicar fica liberado quando a verificação for aprovada.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Progress
          value={(done / steps.length) * 100}
          aria-label="Configuração"
          className="flex-1"
        />
        <span className="type-body-s text-text-secondary">
          {done} de {steps.length}
        </span>
      </div>
      <Steps>
        {steps.map((step, index) => (
          <Step
            key={step.key}
            state={step.state}
            number={index + 1}
            title={step.title}
            detail={step.detail}
            showLine={index < steps.length - 1}
            action={
              step.state === "current" ? (
                <Button asChild variant="secondary" size="s">
                  <Link href={receivingHref}>Continuar</Link>
                </Button>
              ) : undefined
            }
          />
        ))}
      </Steps>
    </Card>
  );
}

/** Figma: Enquanto isso (298:3589): a draft can be made before the verification is approved. */
export function MeanwhileCard({ className }: { className?: string }) {
  return (
    <Card label="Enquanto isso" className={className}>
      <span
        aria-hidden
        className="flex size-control-md items-center justify-center rounded-md bg-bg-accent-subtle text-icon-accent [&_svg]:size-icon-md"
      >
        <Calendar />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="type-heading-h4 text-text-primary">Monte seu primeiro evento</h2>
        <p className="type-body-m text-text-secondary">
          O rascunho fica salvo. Quando a verificação for aprovada, é só publicar.
        </p>
      </div>
      <Button asChild variant="secondary" className="w-full md:w-fit">
        <Link href="/producer/events/new">
          <Plus aria-hidden />
          Criar evento
        </Link>
      </Button>
    </Card>
  );
}
