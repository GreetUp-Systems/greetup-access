import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Campo de texto (44:232), the control: Tamanho S 36, M 44, L 52; radius/md, bg/surface,
 * border/strong; hover border/hover; focus a 2 px border/accent; Erro border/danger (aria-invalid);
 * Desabilitado on bg/canvas. Label, help and error come from Field.
 */
const inputVariants = cva(
  [
    "w-full min-w-0 rounded-md border border-border-strong bg-bg-surface px-4 text-text-primary outline-none",
    "placeholder:text-text-tertiary",
    "hover:border-border-hover",
    // Focus: 2 px in the accent; the extra width is inside, so nothing moves.
    "focus-visible:border-border-accent focus-visible:inset-ring focus-visible:inset-ring-border-accent",
    "aria-invalid:border-border-danger aria-invalid:focus-visible:inset-ring-border-danger",
    "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-bg-canvas disabled:text-text-tertiary",
  ],
  {
    variants: {
      size: {
        s: "h-control-sm type-body-m",
        m: "h-control-md type-body-m",
        l: "h-control-lg type-body-l",
      },
    },
    defaultVariants: { size: "m" },
  },
);

type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, size, ...props }: InputProps) {
  return <input data-slot="input" className={cn(inputVariants({ size }), className)} {...props} />;
}

export { Input, type InputProps };
