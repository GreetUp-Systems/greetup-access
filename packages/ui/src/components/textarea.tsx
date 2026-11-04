import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Área de texto (253:93), the Campo de texto in several lines (the event's description and
 * refund policy, a ticket type's description): radius/md, bg/surface, space/3 by space/4 around
 * three lines of Body/M. The edge is inside, as Figma's stroke, so the field keeps its 84: hover
 * border/hover, focus a 2 px border/accent, Erro border/danger (aria-invalid), Desabilitado on
 * bg/canvas. shadcn/ui Textarea, adapted; label, help and error come from Field.
 */
function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "w-full min-w-0 resize-none rounded-md bg-bg-surface px-4 py-3 type-body-m text-text-primary outline-none",
        "inset-ring inset-ring-border-strong placeholder:text-text-tertiary",
        "hover:inset-ring-border-hover",
        "focus-visible:inset-ring-2 focus-visible:inset-ring-border-accent",
        "aria-invalid:inset-ring-border-danger aria-invalid:focus-visible:inset-ring-border-danger",
        "disabled:cursor-not-allowed disabled:bg-bg-canvas disabled:text-text-tertiary disabled:inset-ring-border-subtle",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
