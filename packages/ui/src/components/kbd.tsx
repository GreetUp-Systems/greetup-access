import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Atalho (279:74). One key of a shortcut (⌘, K, /): size/kbd high, Label/S in
 * text/secondary on bg/subtle with a border/subtle edge. shadcn/ui Kbd.
 */
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-kbd w-fit min-w-kbd items-center justify-center rounded-xs border border-border-subtle bg-bg-subtle px-1-5 type-label-s text-text-secondary select-none",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
