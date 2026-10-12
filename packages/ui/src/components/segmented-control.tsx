"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Controle segmentado (154:520), Selecionada = 1 · 2 (154:510, 154:515). It switches between
 * two views of the same list (Próximos and Anteriores), so it is the list of a Tabs: the app wraps
 * the control and the views in <Tabs value onValueChange> and renders each view in <TabsContent>
 * (tabs.tsx), which keeps the tab semantics and moves between the options with the arrows. A
 * bg/subtle capsule with space/1 around and between the options, size/control-md high (Figma's 4 and
 * 44 are space/1 and size/control-md). It fills its parent, the content width on the phone (328 at
 * 360); on the desktop the screen gives it size/segmented-control, beside the title.
 */
function SegmentedControl({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="segmented-control"
      className={cn("flex h-control-md w-full gap-1 rounded-full bg-bg-subtle p-1", className)}
      {...props}
    />
  );
}

/**
 * Figma: Opção. The options share the width; the selected one gets the glass lens (glass/lens with
 * a glass/rim border, Figma's inside stroke, which also takes Figma's 2 extra in the split) and
 * Body/M Strong in text/primary, the other Body/M in text/secondary. The component has no hover,
 * pressed or focus: hover follows Aba de seção (the label turns text/primary) and pressed and focus
 * follow Barra de abas (the lens alone; an inner accent ring, drawn as an outline so it covers the
 * rim instead of competing with it).
 */
function SegmentedControlItem({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="segmented-control-item"
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center rounded-full type-body-m whitespace-nowrap text-text-secondary outline-none",
        "hover:text-text-primary active:bg-glass-lens",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent",
        "data-[state=active]:border data-[state=active]:border-glass-rim data-[state=active]:bg-glass-lens data-[state=active]:type-body-m-strong data-[state=active]:text-text-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
