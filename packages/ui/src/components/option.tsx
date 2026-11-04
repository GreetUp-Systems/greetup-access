import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Sugestões, the list under a search field (the city of an event, 588:12166): bg/surface,
 * border/subtle, Elevation/2, radius/lg and space/1 around the options. A WAI-ARIA listbox: the
 * field keeps the focus and points at the active option (aria-activedescendant).
 */
function OptionList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      role="listbox"
      data-slot="option-list"
      className={cn(
        "flex flex-col rounded-lg border border-border-subtle bg-bg-surface p-1 shadow-elevation-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Figma: Opção (354:83), Tamanho M (36): Body/M in one line, radius/sm; the active option (by the
 * keyboard or the pointer) on bg/subtle. The pointer picks it without taking the field's focus.
 */
function Option({
  active = false,
  className,
  children,
  onMouseDown,
  ...props
}: ComponentProps<"li"> & { active?: boolean }) {
  return (
    <li
      role="option"
      data-slot="option"
      data-active={active || undefined}
      aria-selected={active}
      className={cn(
        "flex h-control-sm cursor-pointer items-center rounded-sm px-2 type-body-m text-text-primary hover:bg-bg-subtle data-active:bg-bg-subtle",
        className,
      )}
      onMouseDown={(event) => {
        // The field keeps the focus, so the list does not close before the click.
        event.preventDefault();
        onMouseDown?.(event);
      }}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </li>
  );
}

export { Option, OptionList };
