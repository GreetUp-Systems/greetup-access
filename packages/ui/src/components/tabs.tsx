"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Aba de seção (283:18). Tabs inside a card (a table, a list): the label in Body/M Strong,
 * an optional count capsule, and the accent underline (stroke/indicator) under the selected one,
 * space/3 below the label. shadcn/ui Tabs, line variant only: the pill variant is not in the
 * design system.
 */
function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex w-fit items-end gap-6", className)}
      {...props}
    />
  );
}

type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & {
  /** Figma: Mostrar contagem + Contagem. */
  count?: ReactNode;
};

function TabsTrigger({ className, children, count, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab flex flex-col gap-3 rounded-xs type-body-m-strong whitespace-nowrap text-text-secondary outline-none hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-text-primary",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-2">
        {children}
        {count === undefined ? null : (
          <span
            data-slot="tabs-count"
            className="flex h-status-s min-w-status-s items-center justify-center rounded-full bg-bg-subtle px-1-5 type-badge-s text-text-secondary group-data-[state=active]/tab:bg-bg-accent-subtle group-data-[state=active]/tab:text-text-accent"
          >
            {count}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="h-(--stroke-indicator) w-full rounded-full group-data-[state=active]/tab:bg-bg-accent"
      />
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, type TabsTriggerProps };
