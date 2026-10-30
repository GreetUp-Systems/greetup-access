import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Campo de texto (44:232) with Ícone à direita = chevron-down, as in Estado (550:16860) and
 * in the lists of a request for information (548:11354). The browser's own list (SPEC-015 R8) with
 * the field's sizes and states: S 36, M 44, L 52; radius/md, bg/surface, border/strong; hover
 * border/hover; focus a 2 px border/accent; Erro border/danger (aria-invalid); Desabilitado on
 * bg/canvas. The chevron sits space/3 from the text in icon/secondary, 16 in S and 20 in M and L.
 * The option with an empty value is the placeholder ("Escolha"), in text/tertiary while chosen.
 * shadcn/ui NativeSelect, adapted; label, help and error stay with Field.
 */
const nativeSelectVariants = cva(
  [
    // The text stops before the chevron: space/4 to the edge, the icon and space/3.
    "w-full min-w-0 cursor-pointer appearance-none rounded-md border border-border-strong bg-bg-surface pr-12 pl-4 text-text-primary outline-none",
    "has-[option[value='']:checked]:text-text-tertiary [&_option]:text-text-primary",
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

type NativeSelectProps = Omit<ComponentProps<"select">, "size"> &
  VariantProps<typeof nativeSelectVariants>;

/** `className` lays the field out (its width); the look is the field's. */
function NativeSelect({ className, size, ...props }: NativeSelectProps) {
  return (
    <div data-slot="native-select-wrapper" className={cn("relative w-full min-w-0", className)}>
      <select data-slot="native-select" className={nativeSelectVariants({ size })} {...props} />
      <ChevronDown
        aria-hidden
        data-slot="native-select-icon"
        className={cn(
          "pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-icon-secondary",
          size === "s" ? "size-icon-sm" : "size-icon-md",
        )}
      />
    </div>
  );
}

function NativeSelectOption(props: ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

export { NativeSelect, NativeSelectOption, type NativeSelectProps };
