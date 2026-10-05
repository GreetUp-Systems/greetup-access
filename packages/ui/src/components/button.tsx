import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: page "Botão" — Botão/Primário (29:120), Secundário (29:238), Fantasma (29:356),
 * Destrutivo (29:474) and Inverso (130:312); Tamanho S 36, M 44, L 52. shadcn/ui Button with the
 * design system's variants. Hover, pressed and focus are CSS states; disabled and loading are props.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-full border border-transparent",
    // Focus: a 2 px ring 2 px away in the action color; the inner border gives way to it.
    "outline-none focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent",
    // Pressed: 70% opacity, for touch.
    "active:opacity-70",
    "disabled:pointer-events-none disabled:text-text-tertiary",
    "aria-busy:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-bg-accent text-text-on-accent hover:bg-bg-accent-hover disabled:bg-bg-subtle",
        secondary:
          "border-border-strong bg-bg-surface text-text-primary hover:bg-bg-subtle disabled:border-border-subtle",
        ghost: "text-text-primary hover:bg-bg-subtle active:bg-bg-subtle",
        destructive:
          "border-border-danger-subtle bg-bg-danger-subtle text-text-danger hover:bg-bg-danger-subtle-hover focus-visible:outline-border-danger disabled:border-border-subtle disabled:bg-bg-subtle",
        inverse: "bg-bg-inverse text-text-inverse hover:opacity-88 disabled:bg-bg-subtle",
      },
      size: {
        // S and M use UI/Button M with 16 icons; L uses UI/Button L with 20 icons.
        s: "h-control-sm px-3 type-ui-button-m [&_svg]:size-icon-sm",
        m: "h-control-md px-4 type-ui-button-m [&_svg]:size-icon-sm",
        l: "h-control-lg px-6 type-ui-button-l [&_svg]:size-icon-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "m",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Figma: Estado=Carregando. The spinner takes the left icon's place and clicks are ignored. */
    loading?: boolean;
    /** Figma: Ícone esquerdo. A lucide-react icon; size and color come from the button. */
    iconLeft?: ReactNode;
    /** Figma: Ícone direito. */
    iconRight?: ReactNode;
    /** Renders the only child (a link) with the button's look; icons and loading do not apply. */
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  loading = false,
  iconLeft,
  iconRight,
  asChild = false,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

export { Button, type ButtonProps, buttonVariants };
