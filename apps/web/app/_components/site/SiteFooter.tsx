import { Logo } from "@access/ui/components/logo";
import Link from "next/link";

import { footerColumns } from "../../_lib/site/navigation";

/**
 * Figma: Rodapé do site (316:234), Formato = Desktop, with "Mostrar Explorar eventos" and "Mostrar
 * Access" off until the Explorar and the terms exist (SPEC-016 S16). Only on the desktop of the
 * buyer area until the Início (16C).
 */
export function SiteFooter() {
  return (
    <footer className="hidden border-t border-border-subtle bg-bg-surface px-4 md:block">
      <div className="mx-auto flex max-w-page-content flex-col gap-12 pt-16 pb-10">
        <div className="flex gap-16">
          <div className="flex w-footer-brand shrink-0 flex-col gap-3">
            <Logo />
            <p className="type-body-m text-text-secondary">
              Ingressos com Pix, na hora. O ingresso chega com QR Code e o dinheiro vai direto para
              quem produz.
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex gap-16">
            {footerColumns.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <h2 className="type-label-s text-text-tertiary">{column.title}</h2>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block w-fit rounded-sm type-body-m text-text-secondary outline-none hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex gap-2 border-t border-border-subtle pt-6 type-body-s text-text-tertiary">
          {/* /me is prerendered: the client may be in a later year than the build. */}
          <p className="flex-1" suppressHydrationWarning>
            © {new Date().getFullYear()} Access
          </p>
          <p>Pagamentos por Pix processados pela BlindPay.</p>
        </div>
      </div>
    </footer>
  );
}
