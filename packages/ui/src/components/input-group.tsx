"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Campo de texto (44:232) with Ícone à esquerda or Ícone à direita, like the search of the
 * lists (Buscar evento). The control's edge, fill and states move to the group: radius/md,
 * bg/surface, border/strong; hover border/hover; focus a 2 px border/accent; Erro border/danger;
 * Desabilitado on bg/canvas. The icon sits space/3 from the text in icon/secondary, 16 in S and 20
 * in M and L. shadcn/ui InputGroup, adapted; label, help and error stay with Field.
 */
const inputGroupVariants = cva(
  [
    "group/input-group flex w-full min-w-0 items-center gap-3 rounded-md border border-border-strong bg-bg-surface px-4",
    "hover:border-border-hover",
    // Focus: 2 px in the accent; the extra width is inside, so nothing moves.
    "has-focus-visible:border-border-accent has-focus-visible:inset-ring has-focus-visible:inset-ring-border-accent",
    "has-aria-invalid:border-border-danger has-aria-invalid:has-focus-visible:inset-ring-border-danger",
    "has-disabled:cursor-not-allowed has-disabled:border-border-subtle has-disabled:bg-bg-canvas",
  ],
  {
    variants: {
      size: {
        s: "h-control-sm [&_svg]:size-icon-sm",
        m: "h-control-md [&_svg]:size-icon-md",
        l: "h-control-lg [&_svg]:size-icon-md",
      },
    },
    defaultVariants: { size: "m" },
  },
);

type InputGroupProps = ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>;

function InputGroup({ className, size, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-size={size ?? "m"}
      role="group"
      className={cn(inputGroupVariants({ size }), className)}
      {...props}
    />
  );
}

type InputGroupAddonProps = ComponentProps<"div"> & {
  /** Figma: Ícone à esquerda (inline-start) or Ícone à direita (inline-end). */
  align?: "inline-start" | "inline-end";
};

/** The icon beside the text; a click on it focuses the input, as on the field itself. */
function InputGroupAddon({
  className,
  align = "inline-start",
  onClick,
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "flex shrink-0 cursor-text items-center text-icon-secondary select-none data-[align=inline-end]:order-last data-[align=inline-start]:order-first [&>svg]:pointer-events-none",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!(event.target instanceof Element) || event.target.closest("button") === null) {
          event.currentTarget.parentElement?.querySelector("input")?.focus();
        }
      }}
      {...props}
    />
  );
}

/** The input inside the group: Body/M in S and M, Body/L in L, placeholder in text/tertiary. */
function InputGroupInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        "h-full w-full min-w-0 flex-1 bg-transparent type-body-m text-text-primary outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:text-text-tertiary group-data-[size=l]/input-group:type-body-l",
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  type InputGroupAddonProps,
  InputGroupInput,
  type InputGroupProps,
};
