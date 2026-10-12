import { Skeleton } from "@access/ui/components/skeleton";
import { Ticket } from "@access/ui/components/ticket";

import { TextSkeleton } from "../TextSkeleton";

/**
 * Figma: Esqueleto · Ingresso (465:7936, 465:7950): the top and the base of the Ingresso as
 * esqueletos, at their own size: a ticket laid out with its content unseen and its halves pulsing.
 */
export function TicketSkeleton() {
  return (
    <div
      aria-hidden
      className="**:data-[slot=ticket-base]:animate-pulse **:data-[slot=ticket-base]:border-transparent **:data-[slot=ticket-base]:bg-bg-subtle **:data-[slot=ticket-top]:animate-pulse **:data-[slot=ticket-top]:border-transparent **:data-[slot=ticket-top]:bg-bg-subtle **:data-[slot=ticket-base]:*:invisible **:data-[slot=ticket-perforation]:*:invisible **:data-[slot=ticket-top]:*:invisible"
    >
      <Ticket
        state="valid"
        eventName="Festival de Inverno"
        dateTime="Seg, 12 out · 21:00"
        place="Casa Fluida · São Paulo"
        ticketTypeName="Pista"
        code="AX-0042"
        qrValue="AX-0042"
      />
    </div>
  );
}

/**
 * Figma: Ingresso · Carregando (465:7936, 465:7950): before the ticket is known, the back, the
 * title and the detail, the list and the notice on the desktop, and the ticket, as esqueletos.
 */
export function TicketLoading() {
  return (
    <div aria-busy className="flex flex-col">
      <span role="status" className="sr-only">
        Carregando
      </span>
      {/* Phone: the Barra superior's back and title. */}
      <div className="flex h-top-bar items-center gap-2 md:hidden">
        <Skeleton className="size-control-md rounded-full" />
        <TextSkeleton text="Festival de Inverno" type="type-heading-h4" />
      </div>
      <Skeleton className="hidden size-control-md rounded-full md:block" />
      <div className="mt-3 flex flex-col md:mt-4 md:flex-row md:items-start md:gap-16">
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <TextSkeleton text="Festival de Inverno" type="type-heading-h1" />
          <div className="mt-2">
            <TextSkeleton text="Seg, 12 de outubro, 21h · Casa Fluida" type="type-body-l" />
          </div>
          <div className="mt-8">
            <TextSkeleton text="Seus 2 ingressos" type="type-heading-h4" />
          </div>
          <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4">
            {["Ingresso 1 · Pista", "Ingresso 2 · Pista"].map((title) => (
              <div key={title} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-md" />
                <div className="flex flex-col gap-1">
                  <TextSkeleton text={title} type="type-body-l-strong" height="h-4" />
                  <TextSkeleton text="Código AX-0042" type="type-body-m" height="h-3" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <TextSkeleton
              text="Mostre o QR Code na entrada. Cada ingresso vale uma entrada."
              type="type-body-m"
            />
          </div>
        </div>
        <div className="md:w-1/3 md:shrink-0">
          <TicketSkeleton />
        </div>
      </div>
    </div>
  );
}
