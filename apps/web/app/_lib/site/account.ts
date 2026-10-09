import type { ProducerProfile } from "../api/producer";
import { initials } from "../producer/navigation";
import type { SessionState } from "../session";

/** What GET /api/producers/me answered for the signed-in person. */
export type ProducerLookup =
  | { status: "loading" }
  /** 404 producer_not_found, or a failed read (SPEC-016 S18): the person is shown as a buyer. */
  | { status: "none" }
  | { status: "found"; producer: ProducerProfile };

/**
 * Who is on the public site (SPEC-016 S2, S3): the header, the account menu and the Conta follow
 * it. A signed-in person is a buyer, shown by the e-mail, or also a producer, shown by the public
 * name; until the producer read answers, the profile is still loading.
 */
export type SiteAccount =
  | { kind: "loading" }
  | { kind: "visitor" }
  | {
      kind: "member";
      email: string;
      profile: "loading" | "buyer" | { producerName: string };
    };

export function siteAccount(session: SessionState, lookup: ProducerLookup): SiteAccount {
  if (session.status === "loading") {
    return { kind: "loading" };
  }
  if (session.status === "anonymous") {
    return { kind: "visitor" };
  }
  const email = session.account.user.email;
  if (lookup.status === "loading") {
    return { kind: "member", email, profile: "loading" };
  }
  if (lookup.status === "none") {
    return { kind: "member", email, profile: "buyer" };
  }
  return { kind: "member", email, profile: { producerName: lookup.producer.displayName } };
}

/**
 * The buyer's avatar letter: the first letter or digit of the e-mail, since the Access keeps no
 * buyer name (S3).
 */
export function emailInitial(email: string): string {
  const first = /[\p{L}\p{N}]/u.exec(email)?.[0] ?? "";
  return first.toLocaleUpperCase("pt-BR");
}

/** The avatar's text: the public name's initials for a producer, the e-mail's letter otherwise. */
export function accountInitials(
  email: string,
  profile: "buyer" | { producerName: string },
): string {
  return profile === "buyer" ? emailInitial(email) : initials(profile.producerName);
}

export interface SiteLink {
  href: string;
  label: string;
}

// The places of the account (SPEC-016 §6). Destinations that do not exist yet keep their final
// address: /me/tickets arrives with SPEC-014 9D and /producer/start with SPEC-015 15C.
export const siteLinks = {
  tickets: { href: "/me/tickets", label: "Meus ingressos" },
  account: { href: "/me", label: "Conta" },
  // The menu's goes to /producers with SPEC-016 16D; the Conta and the footer keep /producer/start.
  sell: { href: "/producer/start", label: "Vender ingressos" },
  dashboard: { href: "/producer", label: "Painel do produtor" },
} as const satisfies Record<string, SiteLink>;

/**
 * Menu da conta, Contexto = Site (365:246, 365:260): Meus ingressos and Conta, then Vender
 * ingressos for a buyer or Painel do produtor for a producer; "Sair" closes the menu apart.
 */
export function accountMenuGroups(
  profile: "buyer" | { producerName: string },
): readonly (readonly SiteLink[])[] {
  return [
    [siteLinks.tickets, siteLinks.account],
    [profile === "buyer" ? siteLinks.sell : siteLinks.dashboard],
  ];
}
