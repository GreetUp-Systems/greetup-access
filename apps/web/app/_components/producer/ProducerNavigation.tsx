"use client";

import { CalendarFill, LayoutGridFill, WalletFill } from "@access/ui/components/fill-icons";
import { Logo } from "@access/ui/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@access/ui/components/sidebar";
import { TabBar, TabBarItem } from "@access/ui/components/tab-bar";
import { Calendar, LayoutGrid, type LucideIcon, Wallet } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { activeSection, producerNav, type ProducerSection } from "../../_lib/producer/navigation";

const sidebarIcons: Record<ProducerSection, LucideIcon> = {
  dashboard: LayoutGrid,
  events: Calendar,
  receiving: Wallet,
};

// The Barra de abas always shows the filled icons, colored by the tab's state.
const tabIcons: Record<ProducerSection, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: LayoutGridFill,
  events: CalendarFill,
  receiving: WalletFill,
};

function SidebarLogo() {
  const { state } = useSidebar();
  return (
    <div className="pl-3 group-data-[collapsible=icon]:pl-0">
      {state === "collapsed" ? <Logo format="symbol" height={28} /> : <Logo height={28} />}
    </div>
  );
}

interface ProducerSidebarProps {
  pathname: string;
  /** Figma: Selo beside Eventos, what is on sale plus the drafts; null while loading. */
  eventCount: number | null;
  /** The account at the bottom, with its menu. */
  account: ReactNode;
}

/**
 * Figma: Barra lateral (282:572) on the desktop screens of the page "App": the logo at the top,
 * Painel, Eventos and Recebimento, and the account at the bottom; the handle closes it to the
 * icons (⌘B), remembered in a cookie (SPEC-015 N2).
 */
export function ProducerSidebar({ pathname, eventCount, account }: ProducerSidebarProps) {
  const current = activeSection(pathname);
  return (
    <Sidebar aria-label="Sistema do produtor">
      <SidebarTrigger />
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent aria-label="Navegação">
        <SidebarMenu>
          {producerNav.map((item) => {
            const Icon = sidebarIcons[item.section];
            return (
              <SidebarMenuItem key={item.section}>
                <SidebarMenuButton asChild isActive={current === item.section} tooltip={item.label}>
                  <Link href={item.href}>
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                    {item.section === "events" && eventCount !== null && eventCount > 0 ? (
                      <SidebarMenuBadge>{eventCount}</SidebarMenuBadge>
                    ) : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>{account}</SidebarFooter>
    </Sidebar>
  );
}

/** Figma: Barra de abas (73:376) with Painel, Eventos and Recebimento, on the phone. */
export function ProducerTabBar({ pathname }: { pathname: string }) {
  const current = activeSection(pathname);
  return (
    <TabBar aria-label="Navegação">
      {producerNav.map((item) => {
        const Icon = tabIcons[item.section];
        return (
          <TabBarItem key={item.section} asChild selected={current === item.section}>
            <Link href={item.href}>
              <Icon />
              <span>{item.label}</span>
            </Link>
          </TabBarItem>
        );
      })}
    </TabBar>
  );
}
