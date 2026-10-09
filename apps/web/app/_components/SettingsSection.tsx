import type { ReactNode } from "react";

/**
 * Figma: a section of the desktop settings pages, the Perfil do produtor (300:4078) and the Conta
 * (300:4244): its title and description in size/section-aside beside the card.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex gap-12">
      <div className="flex w-section-aside shrink-0 flex-col gap-1">
        <h2 className="type-heading-h4 text-text-primary">{title}</h2>
        <p className="type-body-s text-text-secondary">{description}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-6">
        {children}
      </div>
    </section>
  );
}
