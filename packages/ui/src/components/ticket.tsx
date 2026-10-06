"use client";

import ticketArcs from "@access/ui/assets/ticket-arcs.svg";
import ticketTop from "@access/ui/assets/ticket-top.svg";
import qrSkeleton from "@access/ui/assets/ticket-qr-skeleton.svg";
import { Calendar, LoaderCircle, MapPin } from "lucide-react";
import type { ComponentProps } from "react";

import { Logo } from "@access/ui/components/logo";
import { QrCode } from "@access/ui/components/qr-code";
import { Status } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";

/** Figma: Estado. Utilizado, Transferido and Cancelado come with Seus ingressos (SPEC-014 9D). */
type TicketState = "valid" | "issuing";

type TicketProps = Omit<ComponentProps<"article">, "children"> & {
  state: TicketState;
  eventName: string;
  /** "Sáb, 12 out · 21:00". */
  dateTime: string;
  place: string | null;
  ticketTypeName: string;
  /** "AX-0042"; null while the ticket is being issued. */
  code: string | null;
  /** The signed QR token (SPEC-008 §6), only for a valid ticket. */
  qrValue?: string | undefined;
};

/**
 * Figma: Ingresso (56:409). The top keeps the brand's light and arcs (exported from the
 * component, the arcs at their place from the left edge); a perforation separates the base, whose plate is always light with dark modules,
 * in any mode, for the reader. Emitindo shows the plate's skeleton while the ticket is minted.
 */
function Ticket({
  state,
  eventName,
  dateTime,
  place,
  ticketTypeName,
  code,
  qrValue,
  className,
  ...props
}: TicketProps) {
  const valid = state === "valid";

  return (
    <article
      data-slot="ticket"
      data-state={state}
      aria-label={`Ingresso ${ticketTypeName} · ${eventName}`}
      className={cn("flex flex-col", className)}
      {...props}
    >
      <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-t-xl rounded-b-lg border border-border-subtle bg-bg-surface p-6">
        {/* Topo: the light stretches with the ticket; the arcs keep their size and place. */}
        <img
          src={ticketTop.src}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 -z-10 size-full"
        />
        <img
          src={ticketArcs.src}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 -z-10 size-full object-none object-top-left"
        />
        <div className="flex items-center gap-2">
          <Logo format="symbol" height={24} />
          <Status status={valid ? "valid" : "paid"} size="m" />
        </div>
        <h2 className="type-heading-h3 text-text-primary">{eventName}</h2>
        <div className="flex flex-col gap-2 [&_svg]:size-icon-sm [&_svg]:shrink-0 [&_svg]:text-icon-secondary">
          <p className="flex items-center gap-2 type-body-m text-text-secondary">
            <Calendar aria-hidden />
            {dateTime}
          </p>
          {place === null ? null : (
            <p className="flex items-center gap-2 type-body-m text-text-secondary">
              <MapPin aria-hidden />
              {place}
            </p>
          )}
        </div>
        <p className="flex items-center gap-2">
          <span className="type-body-s text-text-secondary">Ingresso</span>
          <span className="type-body-m-strong text-text-primary">{ticketTypeName}</span>
        </p>
      </div>

      {/* Perfuração: a dashed line between the two parts. */}
      <div aria-hidden className="px-6">
        <svg className="block h-px w-full text-border-strong">
          <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="currentColor" strokeDasharray="6 6" />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface p-6">
        <div className="relative flex size-qr-plate items-center justify-center rounded-lg border border-border-subtle bg-(--palette-brand-creme)">
          {valid && qrValue !== undefined ? (
            <QrCode value={qrValue} label="QR Code do ingresso" className="size-qr" />
          ) : (
            <>
              <img src={qrSkeleton.src} alt="" aria-hidden draggable={false} className="size-qr" />
              <span className="absolute flex flex-col items-center gap-2 rounded-lg bg-(--palette-brand-creme) px-8 py-4 type-body-m-strong text-(--palette-green-700)">
                <LoaderCircle aria-hidden className="size-icon-xl animate-spin" />
                Emitindo
              </span>
            </>
          )}
        </div>
        <span className={cn("type-mono-l", valid ? "text-text-primary" : "text-text-tertiary")}>
          {code ?? "AX-····"}
        </span>
        <p
          className={cn(
            "text-center type-body-s",
            valid ? "text-text-tertiary" : "text-text-success",
          )}
        >
          {valid
            ? "Aproxime o código do leitor na entrada."
            : "Pix confirmado. Leva alguns segundos."}
        </p>
      </div>
    </article>
  );
}

export { Ticket, type TicketProps, type TicketState };
