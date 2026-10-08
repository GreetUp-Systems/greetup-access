"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Progresso (283:19). Sold over capacity: a space/1-5 high bg/subtle track with the
 * bg/accent value, both fully rounded. shadcn/ui Progress; `value` is 0 to 100.
 */
function Progress({ className, value, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const percent = Math.min(100, Math.max(0, value ?? 0));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={percent}
      className={cn(
        "relative flex h-1-5 w-full overflow-hidden rounded-full bg-bg-subtle",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full rounded-full bg-bg-accent"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
