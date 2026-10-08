import { cva, type VariantProps } from "class-variance-authority";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Tendência (279:208). A number against the previous period: a size/status-s capsule with
 * the arrow and the value in Badge/S, green when it grew, red when it fell, neutral without an
 * arrow (shadcn/ui Badge style). The direction is also spoken, so color and arrow are not the
 * only signal.
 */
const trendVariants = cva(
  "inline-flex h-status-s w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 type-badge-s whitespace-nowrap [&>svg]:size-icon-xs [&>svg]:shrink-0",
  {
    variants: {
      direction: {
        positive: "bg-bg-success-subtle text-text-success",
        negative: "bg-bg-danger-subtle text-text-danger",
        neutral: "bg-bg-subtle text-text-secondary",
      },
    },
    defaultVariants: { direction: "neutral" },
  },
);

type TrendDirection = NonNullable<VariantProps<typeof trendVariants>["direction"]>;

const spoken: Record<TrendDirection, string> = {
  positive: "Alta de ",
  negative: "Queda de ",
  neutral: "",
};

type TrendProps = ComponentProps<"span"> & {
  /** Figma: Variação = Positiva · Negativa · Neutra. */
  direction?: TrendDirection;
};

function Trend({ className, direction = "neutral", children, ...props }: TrendProps) {
  return (
    <span data-slot="trend" className={cn(trendVariants({ direction }), className)} {...props}>
      {direction === "positive" ? <ArrowUp aria-hidden /> : null}
      {direction === "negative" ? <ArrowDown aria-hidden /> : null}
      <span className="sr-only">{spoken[direction]}</span>
      {children}
    </span>
  );
}

export { Trend, type TrendDirection, type TrendProps };
