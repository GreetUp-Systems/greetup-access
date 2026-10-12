import { Button } from "@access/ui/components/button";
import { EventCard } from "@access/ui/components/event-card";
import { Skeleton } from "@access/ui/components/skeleton";
import { cn } from "@access/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Figma: Meus ingressos · Vazio (176:5667, 176:2209), Sem próximos (465:18713, 465:18777) and
 * Anteriores · Vazio (465:18822, 465:18890): a title and a line, under the tabs.
 */
export function TicketsEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 md:gap-2">
      <h2 className="type-heading-h4 text-text-primary md:type-heading-h3">{title}</h2>
      <p className="type-body-m text-text-secondary md:max-w-empty-text md:type-body-l">
        {description}
      </p>
    </div>
  );
}

/** An esqueleto with the size of what will come: the card is laid out, unseen, under it. */
function CardSkeleton({
  className,
  radius,
  children,
}: {
  className?: string;
  /** The card's radius: radius/lg, radius/xl for the Destaque largo. */
  radius: "rounded-lg" | "rounded-xl";
  children: ReactNode;
}) {
  return (
    <div aria-hidden className={cn("relative", className)}>
      <div className="invisible">{children}</div>
      <Skeleton className={cn("absolute inset-0", radius)} />
    </div>
  );
}

const sample = {
  title: "Festival de Inverno",
  coverUrl: null,
  date: "Seg, 12 out · 21h",
  place: "Casa Fluida · São Paulo",
  countdown: "Em 6 dias",
  badges: ["2 ingressos", "Pista"],
};

/**
 * Figma: Meus ingressos · Carregando (465:18230, 465:18327): the title and the tabs are real; the
 * Destaque largo on the desktop, and the Destaque and two rows on the phone, as esqueletos.
 */
export function TicketsLoading() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <span role="status" className="sr-only">
        Carregando
      </span>
      <CardSkeleton radius="rounded-lg" className="md:hidden">
        <EventCard
          type="feature"
          {...sample}
          action={
            <Button variant="inverse" size="l">
              Mostrar ingresso
            </Button>
          }
        />
      </CardSkeleton>
      <CardSkeleton radius="rounded-xl" className="hidden md:block">
        <EventCard
          type="wide"
          {...sample}
          place="Casa Fluida · Rua Augusta, 1200, São Paulo"
          action={
            <Button variant="inverse" size="l">
              Mostrar ingresso
            </Button>
          }
        />
      </CardSkeleton>
      {["Noite de Jazz", "Feira Criativa"].map((title) => (
        <CardSkeleton key={title} radius="rounded-lg" className="md:hidden">
          <EventCard
            type="row"
            state="default"
            title={title}
            coverUrl={null}
            detail="Qui, 5 nov · Rio de Janeiro"
            tickets="1 ingresso · Pista"
          />
        </CardSkeleton>
      ))}
    </div>
  );
}
