import { cva } from "class-variance-authority";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Etapa (294:71). One step of a list (the setup of the payout account): a 28 indicator with
 * the number or an icon, the line to the next step, the title in Body/M Strong, the detail in Body/S
 * and the action of the current step. Done is green, current is outlined in accent, in progress
 * spins, pending is quiet and error is red. A composition with the shadcn/ui Button.
 */
type StepState = "done" | "current" | "in_progress" | "pending" | "error";

const circleVariants = cva(
  "flex size-status-m shrink-0 items-center justify-center rounded-full type-badge-m [&>svg]:size-icon-sm",
  {
    variants: {
      state: {
        done: "bg-bg-success-subtle text-icon-success",
        current: "border border-border-accent bg-bg-accent-subtle text-text-accent",
        in_progress: "bg-bg-accent-subtle text-icon-accent",
        pending: "border border-border-strong text-text-tertiary",
        error: "bg-bg-danger-subtle text-icon-danger",
      },
    },
  },
);

type StepProps = Omit<ComponentProps<"li">, "title"> & {
  /** Figma: Estado = Concluída · Atual · Em andamento · Pendente · Erro. */
  state: StepState;
  /** Figma: Número. Shown when the step is current or pending. */
  number: number;
  title: ReactNode;
  detail: ReactNode;
  /** Figma: Mostrar ação. The button of the current step or of the error. */
  action?: ReactNode;
  /** Figma: Mostrar linha. Off on the last step. */
  showLine?: boolean;
};

function Step({
  state,
  number,
  title,
  detail,
  action,
  showLine = true,
  className,
  ...props
}: StepProps) {
  return (
    <li
      data-slot="step"
      data-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className={cn("flex items-start gap-4", className)}
      {...props}
    >
      <span className="flex flex-col items-center gap-1 self-stretch" aria-hidden>
        <span className={circleVariants({ state })}>
          {state === "done" ? <Check /> : null}
          {state === "in_progress" ? <LoaderCircle className="animate-spin" /> : null}
          {state === "error" ? <TriangleAlert /> : null}
          {state === "current" || state === "pending" ? number : null}
        </span>
        {showLine ? (
          <span
            className={cn(
              "w-(--stroke-indicator) min-h-px flex-1 rounded-full bg-border-subtle",
              state === "done" && "bg-border-success",
            )}
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pt-1 pb-6">
        <span
          className={cn(
            "type-body-m-strong text-text-primary",
            state === "pending" && "text-text-secondary",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "type-body-s text-text-secondary",
            (state === "done" || state === "pending") && "text-text-tertiary",
            state === "error" && "text-text-danger",
          )}
        >
          {detail}
        </span>
      </span>
      {action === undefined ? null : <span className="shrink-0">{action}</span>}
    </li>
  );
}

function Steps({ className, ...props }: ComponentProps<"ol">) {
  return <ol data-slot="steps" className={cn("flex flex-col", className)} {...props} />;
}

export { Step, type StepProps, Steps, type StepState };
