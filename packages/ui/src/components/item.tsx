import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Item de lista (66:322), Densidade = Confortável (70) · Compacto (54). Selecionado fills
 * bg/accent-subtle with a stroke/indicator accent bar; Desabilitado turns the text tertiary.
 * An item that is a link or a button (asChild) gets hover (bg/subtle, the tile on bg/surface) and
 * a 2 px inner focus border.
 */
const itemVariants = cva(
  [
    "group/item relative flex w-full items-center gap-3 overflow-hidden rounded-md px-4 text-left text-text-primary outline-none",
    "data-interactive:cursor-pointer data-interactive:hover:bg-bg-subtle",
    "focus-visible:inset-ring-2 focus-visible:inset-ring-border-accent",
    "data-selected:bg-bg-accent-subtle data-selected:hover:bg-bg-accent-subtle",
    "data-selected:before:absolute data-selected:before:inset-y-0 data-selected:before:start-0 data-selected:before:w-(--stroke-indicator) data-selected:before:bg-bg-accent",
    "aria-disabled:pointer-events-none",
  ],
  {
    variants: {
      size: {
        comfortable: "py-3",
        compact: "py-2",
      },
      divider: {
        true: "after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border-subtle",
        false: "",
      },
    },
    defaultVariants: { size: "comfortable", divider: false },
  },
);

type ItemProps = ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & {
    /** Figma: Estado = Selecionado. */
    selected?: boolean;
    /** Renders the only child (a button or a link) as the item. */
    asChild?: boolean;
  };

function Item({ className, size, divider, selected, asChild = false, ...props }: ItemProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="item"
      data-size={size ?? "comfortable"}
      data-selected={selected || undefined}
      data-interactive={asChild || undefined}
      className={cn(itemVariants({ size, divider }), className)}
      {...props}
    />
  );
}

/** Figma: Ícone, the tile twice the icon size (20 in a 40 tile, 16 in a 32 tile when compact). */
function ItemMedia({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-media"
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-primary [&_svg]:size-icon-md",
        "group-data-[size=compact]/item:size-8 group-data-[size=compact]/item:[&_svg]:size-icon-sm",
        "group-data-interactive/item:group-hover/item:bg-bg-surface",
        "group-data-selected/item:bg-bg-accent-subtle group-data-selected/item:text-icon-accent",
        className,
      )}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-0-5", className)}
      {...props}
    />
  );
}

/** Figma: Título, Body/L Strong (Body/M Strong when compact), one line. */
function ItemTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "truncate type-body-l-strong group-data-[size=compact]/item:type-body-m-strong",
        "group-aria-disabled/item:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Subtítulo, Body/M (Body/S when compact) in text/secondary, one line. */
function ItemDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "truncate type-body-m text-text-secondary group-data-[size=compact]/item:type-body-s",
        "group-aria-disabled/item:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Fim, the value (Mono/M), the badge and the arrow or the check. */
function ItemActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn(
        "flex shrink-0 items-center gap-2 [&_svg]:size-icon-md [&_svg]:text-icon-primary",
        "group-data-selected/item:[&_svg]:text-icon-accent group-aria-disabled/item:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, type ItemProps, ItemTitle };
