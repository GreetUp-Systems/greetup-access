"use client";

import { ChevronLeft, X } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

import { Button } from "@access/ui/components/button";
import { Logo } from "@access/ui/components/logo";
import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Barra superior (70:318). Floating top controls with no background band (iOS 26 style):
 * size/top-bar tall, 44 controls, 16 margin. Tipo = Navegação (back, title, up to two actions in a
 * glass capsule) · Marca (logo and the capsule) · Modal (title and close). Rolagem = Rolado adds a
 * fade, glass/scrim down to 68% then glass/clear, from 48 above the bar to one bar below it, so the
 * content scrolling underneath never hits the title. The caller says when it has scrolled.
 */
interface TopBarAction {
  label: string;
  icon: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
}

type Actions = readonly [TopBarAction] | readonly [TopBarAction, TopBarAction];

interface TopBarBaseProps {
  className?: string;
  scrolled?: boolean;
}

type TopBarProps = TopBarBaseProps &
  (
    | {
        type: "navigation";
        title: string;
        subtitle?: string | undefined;
        /** Figma: Mostrar voltar. Without it the title starts at the screen margin. */
        onBack?: MouseEventHandler<HTMLButtonElement> | undefined;
        backLabel?: string;
        actions?: Actions | undefined;
      }
    | { type: "brand"; actions?: Actions | undefined }
    | {
        type: "modal";
        title: string;
        subtitle?: string | undefined;
        onClose: MouseEventHandler<HTMLButtonElement>;
        closeLabel?: string;
      }
  );

function TopBar(props: TopBarProps) {
  const { className, scrolled = false } = props;
  return (
    <header
      data-slot="top-bar"
      className={cn(
        "sticky top-0 z-10 flex h-top-bar items-center gap-2 px-4",
        scrolled &&
          "before:pointer-events-none before:absolute before:inset-x-0 before:-top-12 before:-bottom-top-bar before:-z-10 before:bg-linear-to-b before:from-glass-scrim before:from-68% before:to-glass-clear",
        className,
      )}
    >
      {props.type === "navigation" && props.onBack !== undefined ? (
        <Button
          variant="glass"
          size="icon-glass"
          aria-label={props.backLabel ?? "Voltar"}
          onClick={props.onBack}
        >
          <ChevronLeft />
        </Button>
      ) : null}

      {props.type === "brand" ? (
        <span className="flex min-w-0 flex-1">
          <Logo />
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-heading-h4 text-text-primary">{props.title}</span>
          {props.subtitle !== undefined ? (
            <span className="truncate type-body-s text-text-secondary">{props.subtitle}</span>
          ) : null}
        </span>
      )}

      {props.type !== "modal" && props.actions !== undefined ? (
        <span className="flex shrink-0 rounded-full border border-glass-rim bg-glass-surface shadow-glass-superficie backdrop-blur-glass-superficie">
          {props.actions.map((action) => (
            <Button
              key={action.label}
              variant="glass-bare"
              size="icon-glass"
              aria-label={action.label}
              onClick={action.onClick}
            >
              {action.icon}
            </Button>
          ))}
        </span>
      ) : null}

      {props.type === "modal" ? (
        <Button
          variant="glass"
          size="icon-glass"
          aria-label={props.closeLabel ?? "Fechar"}
          onClick={props.onClose}
        >
          <X />
        </Button>
      ) : null}
    </header>
  );
}

export { TopBar, type TopBarAction, type TopBarProps };
