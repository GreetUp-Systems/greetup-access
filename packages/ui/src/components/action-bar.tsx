import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Barra de ações (354:15101), the glass bar of a phone screen's actions (publish, save, the
 * sheet's action): Glass/Superfície, radius/xl, space/3 around M buttons that share the width. One
 * action: the main one (Inverso) fills it. Two: the secondary on the left, the main on the right.
 * Where it sits (fixed at the bottom of the page, or at the end of a sheet) is the caller's.
 */
function ActionBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="action-bar"
      className={cn(
        "flex items-center gap-3 rounded-xl bg-glass-surface p-3 shadow-glass-superficie backdrop-blur-glass-superficie [&>*]:min-w-0 [&>*]:flex-1",
        className,
      )}
      {...props}
    />
  );
}

export { ActionBar };
