import { type SiteLink, siteLinks } from "./account";

/** The tabs of the public site on the phone (SPEC-016 S4). */
export type SiteTab = "home" | "tickets" | "account";

export const siteTabs: ReadonlyArray<SiteLink & { tab: SiteTab }> = [
  // The Início arrives with SPEC-016 16C; the tab already points to it (S22).
  { tab: "home", href: "/", label: "Início" },
  { tab: "tickets", href: siteLinks.tickets.href, label: "Ingressos" },
  { tab: "account", href: siteLinks.account.href, label: "Conta" },
];

function clean(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** The tab a path belongs to; pages outside the three sections belong to none. */
export function activeTab(pathname: string): SiteTab | null {
  const path = clean(pathname);
  if (path === "/") {
    return "home";
  }
  if (path === "/me/tickets" || path.startsWith("/me/tickets/")) {
    return "tickets";
  }
  if (path === "/me") {
    return "account";
  }
  return null;
}

/**
 * The Barra de abas only on the root of each tab: the opened ticket (/me/tickets/[id]) has its own
 * back button instead (S4).
 */
export function showsSiteTabBar(pathname: string): boolean {
  const path = clean(pathname);
  return siteTabs.some((tab) => tab.href === path);
}

/**
 * Rodapé do site (316:234) until the Início (S16): only the places that exist or arrive before the
 * real validation. "Explorar eventos" comes with 16C; the Access column, with the terms.
 */
export const footerColumns: ReadonlyArray<{ title: string; links: readonly SiteLink[] }> = [
  { title: "Para você", links: [siteLinks.tickets] },
  { title: "Para produtores", links: [siteLinks.sell, siteLinks.dashboard] },
];
