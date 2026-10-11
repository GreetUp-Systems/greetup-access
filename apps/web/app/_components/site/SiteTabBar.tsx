"use client";

import { HouseFill, TicketFill, UserFill } from "@access/ui/components/fill-icons";
import { TabBar, TabBarItem } from "@access/ui/components/tab-bar";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { activeTab, type SiteTab, siteTabs } from "../../_lib/site/navigation";

const icons: Record<SiteTab, ComponentType<SVGProps<SVGSVGElement>>> = {
  home: HouseFill,
  tickets: TicketFill,
  account: UserFill,
};

/**
 * Figma: Barra de abas (73:376), Abas = 3, with Início · Ingressos · Conta (Mobile · Conta,
 * 300:4512). For a visitor, Ingressos and Conta lead to "Entrar" (S17).
 */
export function SiteTabBar({ pathname }: { pathname: string }) {
  const current = activeTab(pathname);
  return (
    <TabBar aria-label="Navegação">
      {siteTabs.map((item) => {
        const Icon = icons[item.tab];
        return (
          <TabBarItem key={item.tab} asChild selected={current === item.tab}>
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
