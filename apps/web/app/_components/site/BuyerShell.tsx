"use client";

import { cn } from "@access/ui/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext } from "react";

import { showsSiteTabBar } from "../../_lib/site/navigation";
import { Identification } from "../identification/Identification";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SiteTabBar } from "./SiteTabBar";
import { type SiteAccountState, useSiteAccount } from "./useSiteAccount";

const BuyerAreaContext = createContext<SiteAccountState | null>(null);

/** The account of the buyer area, for its pages (the Conta, and Meus ingressos with the 9D). */
export function useBuyerArea(): SiteAccountState {
  const context = useContext(BuyerAreaContext);
  if (context === null) {
    throw new Error("useBuyerArea must be used inside BuyerShell.");
  }
  return context;
}

/**
 * The buyer area of the public site (SPEC-016 16A): the Cabeçalho do site and the footer on the
 * desktop, the Barra de abas on the phone (not on the opened ticket, S4). It asks for a session:
 * without one, the identification of SPEC-014 with origin "login" opens over the frame, and the
 * page loads once the code is accepted; closing it goes to the Início (S17).
 */
export function BuyerShell({ children }: { children: ReactNode }) {
  const site = useSiteAccount();
  const pathname = usePathname();
  const router = useRouter();
  const tabBar = showsSiteTabBar(pathname);
  const signedOut = site.account.kind === "visitor";

  return (
    <BuyerAreaContext.Provider value={site}>
      <div className="flex min-h-dvh flex-col bg-bg-canvas">
        <SiteHeader account={site.account} onSignIn={() => undefined} onSignOut={site.signOut} />
        {/* The 16 margin stays outside the size/page-content column, as on the event page. */}
        <div className={cn("flex-1 px-4 pt-2 md:pt-10 md:pb-20", tabBar ? "pb-24" : "pb-8")}>
          <main className="mx-auto w-full max-w-page-content">{signedOut ? null : children}</main>
        </div>
        <SiteFooter />
        {tabBar ? <SiteTabBar pathname={pathname} /> : null}
      </div>
      {signedOut && !site.leaving ? (
        <Identification
          origin="login"
          onClose={() => router.replace("/")}
          onDone={() => undefined}
        />
      ) : null}
    </BuyerAreaContext.Provider>
  );
}
