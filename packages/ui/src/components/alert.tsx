import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, CircleX, Info, Send, TriangleAlert, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@access/ui/components/button";
import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Toast (77:527) shown in the screen's flow (the order kept, the total changed, a failure,
 * the notices of the Painel). Glass (Glass/Superfície) with the tone's translucent tint over it;
 * the tint colors the icon and the title, the message stays text/primary. Tom = Sucesso · Neutro ·
 * Destaque · Erro · Atenção. Mostrar fechar puts a ghost S icon button in the place of a 20 icon;
 * Mostrar ação adds a line with a ghost S button at the end, its label on the text's edge.
 */
const alertVariants = cva(
  [
    "group/alert flex w-full flex-col gap-1 rounded-xl border border-glass-rim bg-glass-surface px-4 py-3 text-left",
    "shadow-glass-superficie backdrop-blur-glass-superficie",
  ],
  {
    variants: {
      tone: {
        success: "bg-linear-to-b from-glass-tint-success to-glass-tint-success",
        neutral: "",
        accent: "bg-linear-to-b from-glass-tint-accent to-glass-tint-accent",
        danger: "bg-linear-to-b from-glass-tint-danger to-glass-tint-danger",
        warning: "bg-linear-to-b from-glass-tint-warning to-glass-tint-warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const toneIcons = {
  success: { icon: CircleCheck, color: "text-icon-success" },
  neutral: { icon: Info, color: "text-icon-secondary" },
  accent: { icon: Send, color: "text-icon-accent" },
  danger: { icon: CircleX, color: "text-icon-danger" },
  warning: { icon: TriangleAlert, color: "text-icon-warning" },
} as const;

type AlertProps = ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /** Figma: Mostrar ação. A ghost S button (or link) at the end of its own line. */
    action?: ReactNode;
    /** Figma: Mostrar fechar. Dismisses the notice. */
    onClose?: () => void;
  };

/** Danger and warning interrupt screen readers (role alert); the others are polite (status). */
function Alert({ className, tone, action, onClose, children, ...props }: AlertProps) {
  const key = tone ?? "neutral";
  const { icon: Icon, color } = toneIcons[key];
  return (
    <div
      data-slot="alert"
      data-tone={key}
      role={key === "danger" || key === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn("size-icon-md shrink-0", color)} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        {onClose === undefined ? null : (
          <Button
            variant="ghost"
            size="icon-s"
            aria-label="Fechar"
            onClick={onClose}
            className="-m-2 shrink-0"
          >
            <X />
          </Button>
        )}
      </div>
      {action === undefined ? null : <div className="-my-1 -mr-3 flex justify-end">{action}</div>}
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
