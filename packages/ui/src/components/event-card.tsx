import cardArt from "@access/ui/assets/cover-card.svg";
import featureArt from "@access/ui/assets/cover-feature.svg";
import { Calendar, ChevronRight, Clock, MapPin } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { EventThumbnail } from "@access/ui/components/event-cover";
import { Status } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";

type CardBase = Omit<ComponentProps<"article">, "title"> & {
  /** Figma: Título. */
  title: string;
  /** The event's cover (16:9); null shows the brand's art (Mostrar capa off). */
  coverUrl: string | null;
  /**
   * Renders the only child (a link) as the card, which then opens as a whole (SPEC-014 M7): the
   * rows and the cards without an action.
   */
  asChild?: boolean;
  /** The title's level in the page: h2 for the next event, h3 under a section (the default). */
  heading?: "h2" | "h3";
};

type FeatureProps = CardBase & {
  /** Figma: Tipo = Destaque (the art on top) or Destaque largo (the art at the side, desktop). */
  type: "feature" | "wide";
  /** Figma: Data, "Seg, 12 out · 21h". */
  date: string;
  /** Figma: Local, "Casa Fluida · São Paulo"; left out when null. */
  place: string | null;
  /** Figma: Contagem, "Em 6 dias". */
  countdown: string;
  /** Figma: Selo 1 and Selo 2, "2 ingressos" and "Pista". */
  badges: readonly string[];
  /** Figma: Mostrar ação, "Mostrar ingresso" (Botão/Inverso L). */
  action?: ReactNode;
  /** Figma: Mostrar ver evento, "Ver evento" (Botão/Fantasma L), in the Destaque largo. */
  secondaryAction?: ReactNode;
};

type RowProps = CardBase & {
  /** Figma: Tipo = Linha. */
  type: "row";
  /**
   * Figma: Estado. Padrão (with the tickets and the arrow), Anterior (a past event: faded, without a
   * badge) and Cancelado (faded, with the Status). Utilizado comes with the check-in (SPEC-009).
   */
  state: "default" | "past" | "cancelled";
  /** Figma: Detalhe, "Qui, 5 nov · Rio de Janeiro". */
  detail: string;
  /** Figma: Ingressos, "1 ingresso · Pista", only in Padrão. */
  tickets?: string;
};

type EventCardProps = FeatureProps | RowProps;

const interactive =
  "outline-none data-interactive:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent";

/**
 * Figma: Cartão de evento (154:601), the events of Meus ingressos (SPEC-014 M1, M6). Destaque
 * (154:521): the art on top, size/card-art high, with the countdown on glass over it, and the
 * "Mostrar ingresso" action when it is the next event on the phone. Destaque largo (468:70): the
 * next event on the desktop, the art size/feature-art wide at the side. Linha (154:562, 480:49,
 * 154:586): the thumbnail, the title and the detail. Without a cover the brand's art is exported from
 * the component (Mostrar capa off), at each size. Neutral surface; the action is neutral too
 * (Botão/Inverso), passed by the screen.
 */
function EventCard(props: EventCardProps) {
  if (props.type === "row") {
    return <EventCardRow {...props} />;
  }
  return <EventCardFeature {...props} />;
}

function EventCardFeature({
  type,
  title,
  coverUrl,
  date,
  place,
  countdown,
  badges,
  action,
  secondaryAction,
  asChild = false,
  heading: Heading = "h3",
  className,
  children,
  ...props
}: FeatureProps) {
  const Comp = asChild ? Slot.Root : "article";
  const wide = type === "wide";

  return (
    <Comp
      data-slot="event-card"
      data-type={type}
      data-interactive={asChild || undefined}
      className={cn(
        "flex overflow-hidden border border-border-subtle bg-bg-surface",
        wide ? "flex-row rounded-xl" : "flex-col rounded-lg",
        interactive,
        className,
      )}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <div
        className={cn(
          "relative shrink-0",
          wide ? "w-feature-art self-stretch" : "h-card-art w-full",
        )}
      >
        <img
          src={coverUrl ?? (wide ? featureArt.src : cardArt.src)}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
        {wide ? null : (
          // Over the art: the glass of the Barra de ações.
          <Countdown className="absolute top-3 left-3 border border-glass-rim bg-glass-surface shadow-glass-superficie backdrop-blur-glass-superficie">
            {countdown}
          </Countdown>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", wide ? "gap-4 p-10" : "gap-3 p-4")}>
        {wide ? <Countdown className="bg-glass-lens">{countdown}</Countdown> : null}
        <Heading className={cn("text-text-primary", wide ? "type-heading-h1" : "type-heading-h3")}>
          {title}
        </Heading>
        <div
          className={cn(
            "flex flex-col [&_p]:flex [&_p]:items-center [&_p]:gap-2 [&_p]:text-text-secondary [&_svg]:shrink-0 [&_svg]:text-icon-secondary",
            wide
              ? "gap-2 [&_p]:type-body-l [&_svg]:size-icon-md"
              : "gap-1-5 [&_p]:type-body-m [&_svg]:size-icon-sm",
          )}
        >
          <p>
            <Calendar aria-hidden />
            {date}
          </p>
          {place === null ? null : (
            <p>
              <MapPin aria-hidden />
              {place}
            </p>
          )}
        </div>
        {badges.length === 0 ? null : (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span key={badge} className={cn(pill, "bg-glass-lens")}>
                {badge}
              </span>
            ))}
          </div>
        )}
        {action === undefined && secondaryAction === undefined ? null : (
          <div className={cn("flex gap-3", wide ? "flex-row" : "flex-col *:w-full")}>
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </Comp>
  );
}

// Selo and Contagem: a size/status-m capsule in Badge/M, space/2-5 at the sides.
const pill =
  "inline-flex h-status-m w-fit shrink-0 items-center gap-1-5 rounded-full px-2-5 type-badge-m whitespace-nowrap text-text-primary";

function Countdown({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn(pill, className)}>
      <Clock aria-hidden className="size-icon-status-m shrink-0" />
      {children}
    </span>
  );
}

function EventCardRow({
  title,
  coverUrl,
  state,
  detail,
  tickets,
  asChild = false,
  heading: Heading = "h3",
  className,
  children,
  ...props
}: RowProps) {
  const Comp = asChild ? Slot.Root : "article";
  const faded = state !== "default";

  return (
    <Comp
      data-slot="event-card"
      data-type="row"
      data-state={state}
      data-interactive={asChild || undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3",
        interactive,
        className,
      )}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <EventThumbnail src={coverUrl} className={cn("md:size-thumbnail-s", faded && "opacity-50")} />
      <div className="flex min-w-0 flex-1 flex-col gap-0-5">
        <Heading
          className={cn(
            "truncate type-body-l-strong",
            faded ? "text-text-secondary" : "text-text-primary",
          )}
        >
          {title}
        </Heading>
        <p className="truncate type-body-s text-text-secondary">{detail}</p>
        {state === "default" && tickets !== undefined ? (
          <p className="truncate type-body-s text-text-tertiary">{tickets}</p>
        ) : null}
        {state === "cancelled" ? <Status status="cancelled" size="s" /> : null}
      </div>
      {state === "default" ? (
        <ChevronRight aria-hidden className="size-icon-md shrink-0 text-icon-secondary" />
      ) : null}
    </Comp>
  );
}

export { EventCard, type EventCardProps };
