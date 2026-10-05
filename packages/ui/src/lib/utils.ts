import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { blur, radius, shadow, spacing, typography } from "./merge-theme";

// tailwind-merge learns the design system's scales (generated from Figma), so a later class wins
// over an earlier one of the same kind: cn("h-control-md", "h-control-lg") keeps h-control-lg.
const twMerge = extendTailwindMerge<"typography">({
  extend: {
    theme: { spacing, radius, shadow, blur },
    classGroups: { typography: [{ type: typography }] },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
