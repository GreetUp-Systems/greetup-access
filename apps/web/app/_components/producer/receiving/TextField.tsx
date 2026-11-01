"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import { Input } from "@access/ui/components/input";
import type { ComponentProps, ReactNode } from "react";

export interface TextFieldProps extends Omit<ComponentProps<typeof Input>, "id" | "size"> {
  id: string;
  label: string;
  /** The message under the field when something is wrong; replaces the help. */
  error?: string | null;
  help?: ReactNode;
  className?: string;
}

/**
 * Figma: Campo de texto M (44:232) with its label and the help or the error under it, as Seus
 * dados and the request for information use it.
 */
export function TextField({ id, label, error, help, className, ...input }: TextFieldProps) {
  const describedBy =
    error !== null && error !== undefined ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        size="m"
        aria-invalid={error !== null && error !== undefined ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error !== null && error !== undefined ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : help ? (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      ) : null}
    </Field>
  );
}
