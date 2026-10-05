"use client";

import { TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";

import { Label } from "@access/ui/components/label";
import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Campo de texto (44:232) around the control: Rótulo, the Input, then the help text or the
 * error (space/2 apart). The error always has the icon and the message, never color alone; link
 * them to the input with aria-describedby.
 */
function Field({
  className,
  disabled,
  ...props
}: ComponentProps<"div"> & { disabled?: boolean | undefined }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-disabled={disabled || undefined}
      className={cn("group/field flex w-full min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel(props: ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" {...props} />;
}

/** Figma: Texto de ajuda, Body/S. */
function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "type-body-s text-text-secondary group-data-[disabled=true]/field:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Mensagem de erro, Body/S in text/danger with the 16 alert icon. */
function FieldError({ className, children, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn("flex items-center gap-2 type-body-s text-text-danger", className)}
      {...props}
    >
      <TriangleAlert className="size-icon-sm shrink-0 text-icon-danger" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export { Field, FieldDescription, FieldError, FieldLabel };
