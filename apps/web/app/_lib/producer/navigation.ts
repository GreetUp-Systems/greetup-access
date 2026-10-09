/** The places of the producer system's navigation (SPEC-015 N2); Check-in comes with SPEC-009. */
export type ProducerSection = "dashboard" | "events" | "receiving";

export interface ProducerNavItem {
  section: ProducerSection;
  href: string;
  label: string;
}

export const producerNav: readonly ProducerNavItem[] = [
  { section: "dashboard", href: "/producer", label: "Painel" },
  { section: "events", href: "/producer/events", label: "Eventos" },
  { section: "receiving", href: "/producer/receiving", label: "Recebimento" },
];

/** The item the path belongs to; the profile and the focused entry belong to none. */
export function activeSection(pathname: string): ProducerSection | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/producer") {
    return "dashboard";
  }
  if (path === "/producer/events" || path.startsWith("/producer/events/")) {
    return "events";
  }
  if (path === "/producer/receiving" || path.startsWith("/producer/receiving/")) {
    return "receiving";
  }
  return null;
}

/**
 * The phone's Barra de abas only on the root of each section; inner pages (the profile, an event)
 * have a back button instead (Mobile · Perfil do produtor, 300:4356; SPEC-015 N7).
 */
export function showsTabBar(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return producerNav.some((item) => item.href === path);
}

/** Two letters for the avatar: the first letters of the first and the last word. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return "";
  }
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}
