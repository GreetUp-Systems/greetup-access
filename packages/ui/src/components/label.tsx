"use client";

import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/** Figma: the Rótulo of Campo de texto (44:232), Body/M Strong; tertiary when disabled. */
function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "type-body-m-strong text-text-primary select-none",
        "peer-disabled:text-text-tertiary group-data-[disabled=true]/field:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
