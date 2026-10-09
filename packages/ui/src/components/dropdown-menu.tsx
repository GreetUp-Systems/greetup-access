"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
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

/**
 * Figma: Item de menu (281:312). Size s (size/control-sm) in a menu; m (size/control-md, the touch
 * size) is the same row in a sheet, like Folha · Conta (293:2785), where it styles plain links:
 * there, keyboard focus gets the highlight a menu gives the active row.
 */
const menuItemVariants = cva(
  [
    "flex w-full cursor-default items-center gap-2 rounded-sm px-2 type-body-m text-text-primary outline-none select-none",
    "hover:bg-bg-subtle focus-visible:bg-bg-subtle data-highlighted:bg-bg-subtle data-disabled:pointer-events-none data-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-icon-sm [&_svg]:shrink-0 [&_svg]:text-icon-secondary hover:[&_svg]:text-icon-primary focus-visible:[&_svg]:text-icon-primary data-highlighted:[&_svg]:text-icon-primary",
  ],
  {
    variants: {
      size: { s: "h-control-sm", m: "h-control-md" },
      /** Figma: Estado = Destrutivo. */
      variant: {
        default: "",
        destructive:
          "text-text-danger [&_svg]:text-icon-danger hover:[&_svg]:text-icon-danger focus-visible:[&_svg]:text-icon-danger data-highlighted:[&_svg]:text-icon-danger",
      },
    },
    defaultVariants: { size: "s", variant: "default" },
  },
);

type DropdownMenuItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item> &
  Pick<VariantProps<typeof menuItemVariants>, "variant">;

function DropdownMenuItem({ className, variant = "default", ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(menuItemVariants({ size: "s", variant }), className)}
      {...props}
    />
  );
}

function DropdownMenuRadioGroup(props: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * Figma: Menu do período (407:3075). One choice among a few: the chosen row shows the check in
 * the icon's place, and the others keep that place empty, so the labels line up.
 */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(menuItemVariants({ size: "s" }), className)}
      {...props}
    >
      <span className="flex size-icon-sm shrink-0 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check aria-hidden />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  menuItemVariants,
};
