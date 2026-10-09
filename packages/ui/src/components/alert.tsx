import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, CircleX, Info, Send, TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Toast (77:527) shown in the screen's flow (the order kept, the total changed, a failure).
 * Glass (Glass/Superfície) with the tone's translucent tint over it; the tint colors the icon and
 * the title, the message stays text/primary. Tom = Sucesso · Neutro · Destaque · Erro · Atenção.
 */
const alertVariants = cva(
  [
    "group/alert flex w-full items-start gap-3 rounded-xl border border-glass-rim bg-glass-surface px-4 py-3 text-left",
    "shadow-glass-superficie backdrop-blur-glass-superficie",
    "[&>svg]:size-icon-md [&>svg]:shrink-0",
  ],
  {
    variants: {
      tone: {
        success:
          "bg-linear-to-b from-glass-tint-success to-glass-tint-success [&>svg]:text-icon-success",
        neutral: "[&>svg]:text-icon-secondary",
        accent:
          "bg-linear-to-b from-glass-tint-accent to-glass-tint-accent [&>svg]:text-icon-accent",
        danger:
          "bg-linear-to-b from-glass-tint-danger to-glass-tint-danger [&>svg]:text-icon-danger",
        warning:
          "bg-linear-to-b from-glass-tint-warning to-glass-tint-warning [&>svg]:text-icon-warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const toneIcons = {
  success: CircleCheck,
  neutral: Info,
  accent: Send,
  danger: CircleX,
  warning: TriangleAlert,
} as const;

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

/** Danger and warning interrupt screen readers (role alert); the others are polite (status). */
function Alert({ className, tone, children, ...props }: AlertProps) {
  const key = tone ?? "neutral";
  const Icon = toneIcons[key];
  return (
    <div
      data-slot="alert"
      data-tone={key}
      role={key === "danger" || key === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Figma: Título, Body/M Strong in the tone's color. */
function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-title"
      className={cn(
        "type-body-m-strong text-text-secondary",
        "group-data-[tone=success]/alert:text-text-success group-data-[tone=accent]/alert:text-text-accent",
        "group-data-[tone=danger]/alert:text-text-danger group-data-[tone=warning]/alert:text-text-warning",
        className,
      )}
      {...props}
    />
  );
}

/** Figma: Mensagem, Body/M. */
function AlertDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-description"
      className={cn("type-body-m text-text-primary", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, type AlertProps, AlertTitle };
