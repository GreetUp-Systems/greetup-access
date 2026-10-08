"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Menu da conta (365:461) and Item de menu (281:312). A bg/surface panel with a
 * border/subtle edge, radius/lg and Elevation/2; space/1-5 inside, space/0-5 between rows. Rows are
 * size/control-sm high with a 16 icon in icon/secondary and the label in Body/M; the highlighted row
 * gets bg/subtle and the destructive one text/danger. shadcn/ui DropdownMenu.
 */
function DropdownMenu(props: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 flex max-h-(--radix-dropdown-menu-content-available-height) min-w-(--radix-dropdown-menu-trigger-width) origin-(--radix-dropdown-menu-content-transform-origin) flex-col gap-0-5 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-1-5 text-text-primary shadow-elevation-2 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/** A non-interactive row, like the account header (Cabeçalho): space/2 around its content. */
function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("flex items-center gap-3 p-2", className)}
      {...props}
    />
  );
}

type DropdownMenuItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** Figma: Estado = Destrutivo. */
  variant?: "default" | "destructive";
};

function DropdownMenuItem({ className, variant = "default", ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "flex h-control-sm cursor-default items-center gap-2 rounded-sm px-2 type-body-m text-text-primary outline-none select-none hover:bg-bg-subtle data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-bg-subtle [&_svg]:pointer-events-none [&_svg]:size-icon-sm [&_svg]:shrink-0 [&_svg]:text-icon-secondary hover:[&_svg]:text-icon-primary data-highlighted:[&_svg]:text-icon-primary",
        "data-[variant=destructive]:text-text-danger data-[variant=destructive]:[&_svg]:text-icon-danger",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px shrink-0 bg-border-subtle", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  type DropdownMenuItemProps,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
