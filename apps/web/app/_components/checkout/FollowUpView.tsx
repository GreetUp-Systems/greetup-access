"use client";

import { Button } from "@access/ui/components/button";
import { Ticket } from "@access/ui/components/ticket";
import { CircleCheck, LoaderCircle } from "lucide-react";

import type { PurchaseView } from "../../_lib/api/purchases";
import type { TicketView } from "../../_lib/api/tickets";
import { issuingLead, issuingStep, readyLead } from "../../_lib/checkout";
import { formatTicketDateTime } from "../../_lib/format";

/**
 * Figma: Pagamento confirmado (146:2411 mobile, 150:2645 desktop), while the tickets are minted,
 * and Ingresso pronto (146:2500 / 150:2755), with the first ticket's QR. The ready screen leads to
 * Seus ingressos (SPEC-014 9D) and back to the event.
 */
export function FollowUpView({
  purchase,
  ticket,
  onTickets,
  onBack,
}: {
  purchase: PurchaseView;
  /** The first ticket once issued; null while issuing. */
  ticket: TicketView | null;
  onTickets: () => void;
  onBack: () => void;
}) {
  const ready = ticket !== null && ticket.status === "issued";
  const count = purchase.quantity;

  return (
    <>
      <div className="md:px-4">
        <main className="mx-auto w-full max-w-page-content px-4 pt-5 pb-10 md:px-0 md:pt-12">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="flex min-w-0 flex-1 flex-col md:max-w-content-column">
              <h1 className="type-heading-h2 text-text-primary md:type-heading-h1">
                {ready ? "Ingresso pronto" : "Pix confirmado"}
              </h1>
              <p className="mt-2 type-body-m text-text-secondary md:mt-4 md:type-body-l">
                {ready ? readyLead(count) : issuingLead(count)}
                <span className="hidden md:inline">
                  {ready ? " Mostre o QR Code na entrada." : " Leva só alguns segundos."}
                </span>
              </p>
              {ready ? (
                <div className="hidden gap-3 md:mt-6 md:flex">
                  <Button variant="inverse" size="l" onClick={onTickets}>
                    Ver meus ingressos
                  </Button>
                  <Button variant="ghost" size="l" onClick={onBack}>
                    Voltar ao evento
                  </Button>
                </div>
              ) : (
                <ol className="mt-4 hidden rounded-lg border border-border-subtle bg-bg-surface md:block">
                  <li className="flex items-center gap-3 px-5 py-4 type-body-l-strong text-text-primary">
                    <CircleCheck aria-hidden className="size-icon-lg shrink-0 text-icon-success" />
                    Pagamento recebido
                  </li>
                  <li className="flex items-center gap-3 border-t border-border-subtle px-5 py-4 type-body-l text-text-secondary">
                    <LoaderCircle
                      aria-hidden
                      className="size-icon-lg shrink-0 animate-spin text-icon-secondary"
                    />
                    {issuingStep(count)}
                  </li>
                </ol>
              )}
            </div>
            <Ticket
              className="md:w-1/3 md:shrink-0"
              state={ready ? "valid" : "issuing"}
              eventName={purchase.event.name}
              dateTime={formatTicketDateTime(purchase.event.startsAt)}
              place={purchase.event.venueName ?? purchase.event.address}
              ticketTypeName={purchase.ticketType.name}
              code={ready ? ticket.code : null}
              qrValue={ready ? (ticket.qrToken ?? undefined) : undefined}
            />
          </div>
          {ready ? <div className="h-bar md:hidden" /> : null}
        </main>
      </div>

      {ready ? (
        // Phone: Barra de ações, floating over the page.
        <div className="fixed inset-x-4 bottom-4 z-20 flex h-bar items-center gap-3 rounded-xl border border-glass-rim bg-glass-surface pr-3 pl-5 shadow-glass-superficie backdrop-blur-glass-superficie md:hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="type-body-s text-text-secondary">Ingresso 1 de {count}</span>
            <span className="truncate type-heading-h3 text-text-primary">
              {purchase.ticketType.name}
            </span>
          </div>
          <Button variant="inverse" onClick={onTickets}>
            Ver meus ingressos
          </Button>
        </div>
      ) : null}
    </>
  );
}
