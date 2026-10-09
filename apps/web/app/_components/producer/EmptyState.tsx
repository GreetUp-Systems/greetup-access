import type { ReactNode } from "react";

interface EmptyStateProps {
  /** A Lucide icon, drawn in icon/accent inside the bg/accent-subtle circle. */
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * Figma: Vazio, the empty state of a card (Painel · Primeiro evento, 299:3865; Eventos · Aba vazia,
 * 432:3428): the icon in a size/thumbnail-s circle, Heading/H4 and Body/M centered (the text at
 * most size/empty-text wide on the desktop), and an optional action.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center md:p-12">
      <div
        aria-hidden
        className="flex size-thumbnail-s items-center justify-center rounded-full bg-bg-accent-subtle text-icon-accent [&_svg]:size-icon-lg"
      >
        {icon}
      </div>
      <div className="flex w-full flex-col gap-2 md:max-w-empty-text">
        <p className="type-heading-h4 text-text-primary">{title}</p>
        <p className="type-body-m text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  );
}
