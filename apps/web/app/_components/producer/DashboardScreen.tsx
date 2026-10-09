"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@access/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  getOpenRfi,
  getRecentSales,
  getSalesSummary,
  type OpenRfi,
  type ProducerProfile,
  type RecentSale,
  type SalesPeriod,
  type SalesSummary,
} from "../../_lib/api/producer";
import {
  formatDayMonth,
  formatShortDayMonth,
  formatTimeAgo,
  formatWeekdayDate,
} from "../../_lib/format";
import {
  dashboardNotice,
  dashboardView,
  periodDays,
  salesPeriods,
  setupSteps,
} from "../../_lib/producer/dashboard";
import { nextEvent } from "../../_lib/producer/events";
import { useSession } from "../../_lib/session";
import { MeanwhileCard, NextEventCard, RecentSalesCard, SetupCard } from "./DashboardCards";
import { CreateEventButton, EventsCard } from "./EventsCard";
import { PageHeader } from "./PageHeader";
import { useProducer } from "./ProducerContext";
import { ProducerFailed } from "./ProducerStates";
import { SalesOverview } from "./SalesOverview";

const recentLimit = 3;

/**
 * The Painel's own data: the sales of the period and the last sales (only with the numbers), and
 * the open request for information, for its deadline. Read once per period; a failure of the sales
 * offers to try again, a failure of the request leaves the deadline out.
 */
function useDashboardData({
  period,
  sales,
  rfi,
}: {
  period: SalesPeriod;
  sales: boolean;
  rfi: boolean;
}) {
  const { getToken } = useSession();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [recent, setRecent] = useState<RecentSale[] | null>(null);
  const [openRfi, setOpenRfi] = useState<OpenRfi | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sales) {
      return;
    }
    let cancelled = false;
    setFailed(false);
    void (async () => {
      try {
        const token = await tokenRef.current();
        const [periodSales, lastSales] = await Promise.all([
          getSalesSummary(token, period),
          getRecentSales(token, recentLimit),
        ]);
        if (!cancelled) {
          setSummary(periodSales);
          setRecent(lastSales);
          setLoadedAt(new Date());
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sales, period, attempt]);

  useEffect(() => {
    if (!rfi) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const open = await getOpenRfi(await tokenRef.current());
        if (!cancelled) {
          setOpenRfi(open);
        }
      } catch {
        // Without the request, the notice and the step go without the deadline.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rfi]);

  return {
    // Another period's numbers never show under this period's title.
    summary: summary?.period === period ? summary : null,
    recent,
    openRfi,
    loadedAt,
    failed,
    retry: () => setAttempt((value) => value + 1),
  };
}

/** "Tudo pronto para vender" on the first visit after the approval, remembered in the browser. */
function useReadyNotice(producer: ProducerProfile): [boolean, () => void] {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (producer.onboardingStatus !== "ready") {
      return;
    }
    const key = `access-ready-notice:${producer.id}`;
    try {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, "1");
        setVisible(true);
      }
    } catch {
      // Without the browser's storage there is no way to tell the first visit: no notice.
    }
  }, [producer.id, producer.onboardingStatus]);
  return [visible, () => setVisible(false)];
}

function RespondLink() {
  return (
    <Button asChild variant="ghost" size="s">
      <Link href="/producer/receiving">Responder agora</Link>
    </Button>
  );
}

/** Figma: the period of the numbers (Desktop · Painel · Período, 407:2745); 30 days by default. */
function PeriodMenu({
  period,
  onChange,
}: {
  period: SalesPeriod;
  onChange: (period: SalesPeriod) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="s"
          className="md:h-control-md md:px-4"
          iconRight={<ChevronDown aria-hidden />}
        >
          Últimos {periodDays[period]} dias
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-menu">
        <DropdownMenuRadioGroup
          value={period}
          onValueChange={(value) => onChange(value as SalesPeriod)}
        >
          {salesPeriods.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              Últimos {periodDays[value]} dias
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Figma: Painel (284:1571, 291:2431) and its states: Configuração pendente (298:3589), Primeiro
 * evento (299:3865), Vendas pausadas (297:2973) and Pedido de informações (297:3517). SPEC-015 §6.
 */
export function DashboardScreen() {
  const { producer, events, reloadEvents } = useProducer();
  const [period, setPeriod] = useState<SalesPeriod>("30d");
  const [, setMinute] = useState(0);

  useEffect(() => {
    void reloadEvents();
  }, [reloadEvents]);
  // "há 5 min" and "Atualizado há…" move on while the Painel is open.
  useEffect(() => {
    const timer = setInterval(() => setMinute((minute) => minute + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  const now = new Date();

  const view = dashboardView(producer, events);
  const notice = dashboardNotice(producer, events);
  const { status: kyc, hasOpenRfi } = producer.compliance;
  const data = useDashboardData({
    period,
    sales: view === "dashboard",
    rfi: kyc === "compliance_request" || (kyc === "approved_rfi" && hasOpenRfi),
  });
  const [readyNotice, dismissReadyNotice] = useReadyNotice(producer);
  const published = events.some((event) => event.status === "published");
  const deadline = data.openRfi?.expiresAt ?? null;
  const name = producer.displayName;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <PageHeader
        title={`Olá, ${name}`}
        description={formatWeekdayDate(now.toISOString())}
        mobileTitle="Painel"
        mobileDescription={`Olá, ${name}`}
        actions={
          view === "dashboard" ? (
            <>
              <PeriodMenu period={period} onChange={setPeriod} />
              <CreateEventButton size="s" />
            </>
          ) : undefined
        }
      />

      {notice === "paused" ? (
        <Alert tone="danger" action={<RespondLink />}>
          <AlertTitle>Vendas pausadas</AlertTitle>
          <AlertDescription>
            A BlindPay pediu informações sobre seu cadastro. Até você responder, ninguém consegue
            comprar ingressos dos seus eventos.
          </AlertDescription>
        </Alert>
      ) : notice === "rfi" ? (
        <Alert tone="warning" action={<RespondLink />}>
          <AlertTitle>A BlindPay pediu informações</AlertTitle>
          <AlertDescription>
            {deadline === null ? "" : `Responda até ${formatDayMonth(deadline)}. `}As vendas
            continuam enquanto isso.
          </AlertDescription>
        </Alert>
      ) : readyNotice ? (
        <Alert tone="success" onClose={dismissReadyNotice}>
          <AlertTitle>Tudo pronto para vender</AlertTitle>
          <AlertDescription>
            Sua conta de recebimento está ativa e a verificação foi aprovada.
          </AlertDescription>
        </Alert>
      ) : null}

      {view === "setup" ? (
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
          <SetupCard
            className="md:flex-1"
            steps={setupSteps(producer, {
              termsAccepted: false,
              rfiDeadline: deadline === null ? null : formatShortDayMonth(deadline),
            })}
          />
          <MeanwhileCard className="md:w-dashboard-aside md:shrink-0" />
        </div>
      ) : data.failed ? (
        <ProducerFailed onRetry={data.retry} />
      ) : (
        <div className="contents md:flex md:items-start md:gap-6">
          <SalesOverview
            className="order-1 md:order-none md:flex-1"
            summary={data.summary}
            period={period}
            published={published}
            updated={
              published && data.loadedAt !== null
                ? `Atualizado ${formatTimeAgo(data.loadedAt.toISOString(), now)}`
                : ""
            }
          />
          <div className="contents md:flex md:w-dashboard-aside md:shrink-0 md:flex-col md:gap-6">
            <NextEventCard
              className="order-2 md:order-none"
              event={nextEvent(events, now)}
              now={now}
            />
            <RecentSalesCard className="order-4 md:order-none" sales={data.recent} now={now} />
          </div>
        </div>
      )}

      <EventsCard
        className="order-3 md:order-none"
        events={events}
        summary
        defaultTab={view === "setup" ? "drafts" : "on_sale"}
      />
    </div>
  );
}
