import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Categoria (314:170), Estado = Padrão · Selecionada. A Lucide icon of 24 in a 64 circle
 * (bg/surface, border/subtle) and the short label in Body/S below it, space/2 apart; Selecionada
 * takes the accent (bg/accent-subtle, border/accent, icon/accent) and the label in text/primary.
 * Hover darkens the edge; the focus is a 2 px ring around the circle. A composition: with
 * `asChild` the child is the category (a link of the shop window, or the `<label>` of a radio
 * option in the event's form, whose hidden radio draws the focus).
 */
function Category({
  asChild = false,
  selected = false,
  className,
  ...props
}: ComponentProps<"div"> & { asChild?: boolean; selected?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="category"
      data-selected={selected || undefined}
      className={cn(
        "group/category flex cursor-pointer flex-col items-center gap-2 outline-none",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Círculo, with the Lucide icon as its child. */
function CategoryIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="category-icon"
      aria-hidden
      className={cn(
        "flex size-16 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-icon-primary [&>svg]:size-icon-lg",
        "group-hover/category:border-border-hover",
        "group-data-selected/category:border-border-accent group-data-selected/category:bg-bg-accent-subtle group-data-selected/category:text-icon-accent",
        "group-has-focus-visible/category:outline-2 group-has-focus-visible/category:outline-offset-2 group-has-focus-visible/category:outline-solid group-has-focus-visible/category:outline-border-accent",
        "group-focus-visible/category:outline-2 group-focus-visible/category:outline-offset-2 group-focus-visible/category:outline-solid group-focus-visible/category:outline-border-accent",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Rótulo, Body/S. */
function CategoryLabel({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="category-label"
      className={cn(
        "text-center type-body-s whitespace-nowrap text-text-secondary group-data-selected/category:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Category, CategoryIcon, CategoryLabel };
