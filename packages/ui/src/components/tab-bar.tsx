import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Barra de abas (73:376) and Aba (73:39). The phone navigation: a glass capsule 16 from the
 * edges and space/5 from the bottom, over the content (glass/surface, Glass/Superfície, a
 * glass/rim edge drawn as an inset ring so the capsule keeps Figma's 62). Tabs share the width; the
 * icon is always filled at 24 and the label is Tab/Rótulo. The selected tab gets the glass lens and
 * the accent color; pressed shows the lens alone; focus draws an inner ring. Pages leave room at the
 * bottom (pb-24).
 */
function TabBar({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      data-slot="tab-bar"
      className={cn(
        "fixed inset-x-4 bottom-5 z-40 flex rounded-full bg-glass-surface p-1 shadow-glass-superficie inset-ring inset-ring-glass-rim backdrop-blur-glass-superficie md:hidden",
        className,
      )}
      {...props}
    />
  );
}

type TabBarItemProps = ComponentProps<"a"> & {
  /** Render the child (a router link) with the tab's look. */
  asChild?: boolean;
  /** Figma: Estado = Selecionado. */
  selected?: boolean;
};

function TabBarItem({ asChild = false, selected = false, className, ...props }: TabBarItemProps) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="tab-bar-item"
      data-selected={selected}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 pt-2 pb-1-5 text-icon-secondary outline-none active:bg-glass-lens focus-visible:inset-ring-2 focus-visible:inset-ring-border-accent data-[selected=true]:bg-glass-lens data-[selected=true]:text-text-accent [&>span]:w-full [&>span]:truncate [&>span]:text-center [&>span]:type-tab-rotulo [&>span]:text-text-secondary data-[selected=true]:[&>span]:text-text-accent [&>svg]:size-icon-lg [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { TabBar, TabBarItem, type TabBarItemProps };
