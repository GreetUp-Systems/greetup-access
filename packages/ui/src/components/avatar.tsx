"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as AvatarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Avatar (279:11). The initials of the person or the producer on bg/accent-subtle, with a
 * border/subtle ring; no photo in the MVP. Tamanho S 32 (Badge/M) and M 40 (Body/M Strong).
 * shadcn/ui Avatar with AvatarFallback.
 */
const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full border border-border-subtle bg-bg-accent-subtle select-none",
  {
    variants: {
      size: {
        s: "size-avatar-s type-badge-m",
        m: "size-avatar-m type-body-m-strong",
      },
    },
    defaultVariants: { size: "s" },
  },
);

type AvatarProps = ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants>;

function Avatar({ className, size, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center text-text-accent", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, type AvatarProps };
