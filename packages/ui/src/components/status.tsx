import { cva, type VariantProps } from "class-variance-authority";
import {
  CalendarCheck,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Info,
  type LucideIcon,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Status (46:85). A tinted capsule with the state's icon and fixed text (shadcn/ui Badge
 * style): the text belongs to the state and is never rewritten, and the color is never the only
 * signal. Tamanho S 22 (Badge/S) and M 28 (Badge/M).
 */
const statusVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center rounded-full whitespace-nowrap [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        success: "bg-bg-success-subtle text-text-success",
        neutral: "bg-bg-subtle text-text-secondary",
        accent: "bg-bg-accent-subtle text-text-accent",
        danger: "bg-bg-danger-subtle text-text-danger",
        warning: "bg-bg-warning-subtle text-text-warning",
      },
      size: {
        s: "h-status-s gap-1 px-2 type-badge-s [&>svg]:size-icon-xs",
        m: "h-status-m gap-1-5 px-3 type-badge-m [&>svg]:size-icon-status-m",
      },
    },
    defaultVariants: { tone: "neutral", size: "s" },
  },
);

type StatusTone = NonNullable<VariantProps<typeof statusVariants>["tone"]>;

const states = {
  // Ticket
  valid: { label: "Válido", icon: CircleCheck, tone: "success" },
  used: { label: "Utilizado", icon: Check, tone: "neutral" },
  transferred: { label: "Transferido", icon: Send, tone: "accent" },
  cancelled: { label: "Cancelado", icon: CircleX, tone: "danger" },
  // Payment
  awaiting: { label: "Aguardando", icon: Clock, tone: "warning" },
  paid: { label: "Pago", icon: CircleCheck, tone: "success" },
  expired: { label: "Expirado", icon: Clock, tone: "neutral" },
  failed: { label: "Falhou", icon: TriangleAlert, tone: "danger" },
  // Event (a cancelled event reuses the ticket's "Cancelado")
  draft: { label: "Rascunho", icon: EyeOff, tone: "neutral" },
  published: { label: "Publicado", icon: Eye, tone: "success" },
  ended: { label: "Encerrado", icon: CalendarCheck, tone: "neutral" },
  // Producer verification
  in_review: { label: "Em análise", icon: Search, tone: "warning" },
  approved: { label: "Aprovado", icon: CircleCheck, tone: "success" },
  pending: { label: "Pendência", icon: Info, tone: "warning" },
  rejected: { label: "Recusado", icon: CircleX, tone: "danger" },
} as const satisfies Record<string, { label: string; icon: LucideIcon; tone: StatusTone }>;

type StatusState = keyof typeof states;

type StatusProps = Omit<ComponentProps<"span">, "children"> & {
  /** Figma: Status. */
  status: StatusState;
  /** Figma: Tamanho = S · M. */
  size?: VariantProps<typeof statusVariants>["size"];
  /** Figma: Mostrar ícone. Off only in very dense tables. */
  showIcon?: boolean;
};

function Status({ className, status, size, showIcon = true, ...props }: StatusProps) {
  const { label, icon: Icon, tone } = states[status];
  return (
    <span
      data-slot="status"
      data-status={status}
      className={cn(statusVariants({ tone, size }), className)}
      {...props}
    >
      {showIcon ? <Icon aria-hidden /> : null}
      {label}
    </span>
  );
}

export { Status, type StatusProps, type StatusState };
