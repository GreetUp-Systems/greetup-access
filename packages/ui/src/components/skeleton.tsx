import { cn } from "@access/ui/lib/utils";

/**
 * Figma: the esqueleto pattern of Stat Card · Estado=Carregando (114:74) and Header · Sessão
 * carregando (231:5834): a bg/subtle block in the place of what is loading, with that thing's
 * radius, so nothing moves when it arrives. The caller gives the size and radius; it pulses.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse bg-bg-subtle", className)}
      {...props}
    />
  );
}

export { Skeleton };
