"use client";

import { SidebarInset, SidebarProvider } from "@access/ui/components/sidebar";
import { TooltipProvider } from "@access/ui/components/tooltip";
import { cn } from "@access/ui/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { activeEventCount } from "../../_lib/producer/events";
import { showsTabBar } from "../../_lib/producer/navigation";
import { useSession } from "../../_lib/session";
import { Identification } from "../identification/Identification";
import { AccountMenu, AccountSheet } from "./AccountMenu";
import { ProducerContext, type ProducerContextValue } from "./ProducerContext";
import { ProducerSidebar, ProducerTabBar } from "./ProducerNavigation";
import { AccountSkeleton, ProducerFailed, ProducerLoading } from "./ProducerStates";
import { useProducerSystem } from "./useProducerSystem";

interface ProducerShellProps {
  /** The sidebar's state from its cookie, read on the server. */
  defaultOpen: boolean;
  children: ReactNode;
}

interface FrameProps {
  defaultOpen: boolean;
  pathname: string;
  /** Beside Eventos; none while it is not known. */
  eventCount: number | null;
  /** The account at the bottom of the sidebar: the menu, its esqueleto, or nothing. */
  account: ReactNode;
  children: ReactNode;
}

/** The sidebar (desktop) or the Barra de abas (phone) around the page, in every state. */
function Frame({ defaultOpen, pathname, eventCount, account, children }: FrameProps) {
  const tabBar = showsTabBar(pathname);
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <ProducerSidebar pathname={pathname} eventCount={eventCount} account={account} />
        <SidebarInset
          className={cn("px-4 pt-2 md:pt-8 md:pr-8 md:pb-8 md:pl-0", tabBar ? "pb-24" : "pb-8")}
        >
          {children}
        </SidebarInset>
        {tabBar ? <ProducerTabBar pathname={pathname} /> : null}
      </SidebarProvider>
    </TooltipProvider>
  );
}

/**
 * The producer system's frame (SPEC-015 §6, N2–N5). It opens only with a session and a producer
 * profile: without a session, the identification of SPEC-014 ("Entrar"), which keeps the page
 * asked for; closing it goes back to the site. Without a profile, Criar perfil. Until the producer
 * and the events load, the page and the account are esqueletos; a failure offers to try again.
 */
export function ProducerShell({ defaultOpen, children }: ProducerShellProps) {
  const { state: session, getToken, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // Set on "Sair", so the signed-out session goes to the site instead of the identification.
  const [leaving, setLeaving] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const system = useProducerSystem(getToken, session.status === "authenticated" && !leaving);
  const status = system.state.status;

  useEffect(() => {
    if (status === "create_profile") {
      router.replace("/producer/start");
    } else if (status === "sign_in") {
      // The API no longer accepts the session: end it, so the identification asks again.
      void logout();
    }
  }, [status, router, logout]);

  const signOut = useCallback(() => {
    setLeaving(true);
    void logout()
      .catch(() => undefined)
      .finally(() => router.replace("/"));
  }, [logout, router]);

  const openAccount = useCallback(() => setAccountOpen(true), []);
  const { reloadEvents, reloadProducer } = system;
  const ready = system.state.status === "ready" ? system.state : null;
  const email = session.status === "authenticated" ? session.account.user.email : null;

  const context = useMemo<ProducerContextValue | null>(
    () =>
      ready === null || email === null
        ? null
        : {
            producer: ready.producer,
            events: ready.events,
            email,
            reloadEvents,
            reloadProducer,
            openAccount,
          },
    [ready, email, reloadEvents, reloadProducer, openAccount],
  );

  const failed = status === "failed" && !leaving;
  const loading = !failed && (context === null || leaving);
  let account: ReactNode = null;
  if (loading) {
    account = <AccountSkeleton />;
  } else if (context !== null) {
    account = (
      <AccountMenu name={context.producer.displayName} email={context.email} onSignOut={signOut} />
    );
  }

  // One tree for every state, so the sidebar is never mounted again when the data arrives.
  return (
    <ProducerContext.Provider value={context}>
      <Frame
        defaultOpen={defaultOpen}
        pathname={pathname}
        eventCount={context === null ? null : activeEventCount(context.events, new Date())}
        account={account}
      >
        {failed ? (
          <ProducerFailed onRetry={system.retry} />
        ) : loading ? (
          <ProducerLoading />
        ) : (
          children
        )}
      </Frame>
      {context === null ? null : (
        <AccountSheet
          open={accountOpen}
          onOpenChange={setAccountOpen}
          name={context.producer.displayName}
          email={context.email}
          onSignOut={signOut}
        />
      )}
      {session.status === "anonymous" && !leaving ? (
        <Identification
          origin="login"
          onClose={() => router.replace("/")}
          onDone={() => undefined}
        />
      ) : null}
    </ProducerContext.Provider>
  );
}
