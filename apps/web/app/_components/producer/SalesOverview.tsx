"use client";

import { Skeleton } from "@access/ui/components/skeleton";
import { Trend } from "@access/ui/components/trend";
import { cn } from "@access/ui/lib/utils";
import { Ticket, Wallet } from "lucide-react";
import { type ReactNode, useState } from "react";

import type { SalesPeriod, SalesSummary } from "../../_lib/api/producer";
import { brasiliaDay, formatReais, formatShortDayMonth } from "../../_lib/format";
import { chartLabelStep, peakDay, periodDays, salesTrend } from "../../_lib/producer/dashboard";

interface OverviewProps {
  /** Null while it loads. */
  summary: SalesSummary | null;
  period: SalesPeriod;
  /** "Atualizado agora", "Atualizado há 5 min"; empty while it loads. */
  updated: string;
  /** Without anything published yet, the chart explains when it fills (Primeiro evento). */
  published: boolean;
}

/** The value of a number: whole reais after a smaller "R$", or the count; text/tertiary at zero. */
function SalesValue({ cents, compact }: { cents: number; compact?: boolean }) {
  return (
    <span className={cn("text-text-primary", cents === 0 && "text-text-tertiary")}>
      <span className={cn("text-text-tertiary", compact ? "type-heading-h4" : "type-heading-h3")}>
        R${" "}
      </span>
      <span className={compact ? "type-heading-h1" : "type-numeric-display"}>
        {formatReais(cents)}
      </span>
    </span>
  );
}

function Comparison({
  current,
  previous,
  days,
}: {
  current: number;
  previous: number;
  days: number;
}) {
  const trend = salesTrend(current, previous);
  if (trend === null) {
    return current === 0 ? (
      <span className="type-body-s text-text-tertiary">Sem vendas ainda</span>
    ) : null;
  }
  return (
    <span className="flex items-center gap-2">
      <Trend direction={trend.direction}>{trend.percent}%</Trend>
      <span className="type-body-s text-text-tertiary">vs. {days} dias antes</span>
    </span>
  );
}

/** Figma: a number of Visão geral on the desktop (Ingressos vendidos, Vendas), in a card. */
function StatCard({
  icon,
  label,
  highlighted = false,
  value,
  comparison,
}: {
  icon: ReactNode;
  label: string;
  highlighted?: boolean;
  value: ReactNode | null;
  comparison: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border-subtle p-5",
        highlighted && "bg-bg-subtle",
      )}
    >
      <span className="flex items-center gap-2 type-body-m text-text-secondary [&_svg]:size-icon-sm [&_svg]:text-icon-secondary">
        {icon}
        {label}
      </span>
      {value === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="w-fit rounded-sm">
            <span className="invisible type-numeric-display">21.840</span>
          </Skeleton>
          <Skeleton className="h-status-s w-fit rounded-full">
            <span className="invisible px-2 type-badge-s">12% vs. 30 dias</span>
          </Skeleton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {value}
          {comparison}
        </div>
      )}
    </div>
  );
}

/** Figma: a number of Visão geral on the phone: the label with the trend, then the value. */
function MobileStat({
  icon,
  label,
  trend,
  value,
}: {
  icon: ReactNode;
  label: string;
  trend: ReactNode;
  value: ReactNode | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 type-body-m text-text-secondary [&>svg]:size-icon-sm [&>svg]:shrink-0 [&>svg]:text-icon-secondary">
        {icon}
        <span className="flex-1">{label}</span>
        {trend}
      </span>
      {value ?? (
        <Skeleton className="w-fit rounded-sm">
          <span className="invisible type-heading-h1">21.840</span>
        </Skeleton>
      )}
    </div>
  );
}

function MobileTrend({ current, previous }: { current: number; previous: number }) {
  const trend = salesTrend(current, previous);
  return trend === null ? null : <Trend direction={trend.direction}>{trend.percent}%</Trend>;
}

const tooltip =
  "rounded-sm bg-bg-inverse px-2 py-1 type-badge-s whitespace-nowrap text-text-inverse";

/**
 * Figma: Vendas por dia (Gráfico): a bar per day of the period, the best day in bg/accent with its
 * date and value, or the day pointed at. On the desktop the dates go under the bars; on the phone
 * the value sits at the top right. Without anything published yet, it says when it fills.
 */
function SalesChart({
  summary,
  period,
  compact,
  published,
}: {
  summary: SalesSummary | null;
  period: SalesPeriod;
  compact: boolean;
  published: boolean;
}) {
  const [pointed, setPointed] = useState<number | null>(null);
  const height = compact ? "h-chart-compact" : "h-chart";

  if (!published) {
    return (
      <div className={cn("flex flex-col", height, compact ? "pb-1" : "pb-10")}>
        <div className="relative flex flex-1 items-center justify-center border-b border-border-subtle">
          <p className="w-full text-center type-body-s text-balance text-text-tertiary md:max-w-empty-text">
            As vendas por dia aparecem aqui quando o primeiro evento estiver à venda.
          </p>
        </div>
      </div>
    );
  }
  if (summary === null) {
    return <Skeleton className={cn("w-full rounded-md", height)} />;
  }

  const daily = summary.daily;
  const max = Math.max(0, ...daily.map((day) => day.salesCents));
  const peak = peakDay(daily);
  const highlight = pointed ?? peak;
  const many = daily.length > 30;
  const step = chartLabelStep(period);
  const label = (index: number) => {
    const day = daily[index]!;
    return `${formatShortDayMonth(brasiliaDay(day.date))} · R$ ${formatReais(day.salesCents)}`;
  };
  const description =
    peak === null
      ? `Vendas por dia, últimos ${periodDays[period]} dias: nenhuma venda.`
      : `Vendas por dia, últimos ${periodDays[period]} dias. Melhor dia: ${label(peak)}.`;

  return (
    <div className={cn("relative flex flex-col", height, compact ? "pb-2" : "pb-3")}>
      <div
        role="img"
        aria-label={description}
        className={cn(
          "flex min-h-0 flex-1 items-end pt-8",
          compact ? (many ? "gap-0" : "gap-0-5") : many ? "gap-0-5" : "gap-1",
          max === 0 && "border-b border-border-subtle",
        )}
        onPointerLeave={() => setPointed(null)}
      >
        {daily.map((day, index) => {
          const share = max === 0 ? 0 : (day.salesCents / max) * 100;
          const lit = index === highlight && day.salesCents > 0;
          const edge = index / daily.length;
          return (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 items-end"
              onPointerEnter={() => setPointed(index)}
              onPointerDown={() => setPointed(index)}
            >
              <div
                className={cn(
                  "relative w-full",
                  share > 0 && "min-h-0-5",
                  compact || many ? "rounded-xs" : "rounded-sm",
                  lit ? "bg-bg-accent" : "bg-bg-subtle",
                )}
                style={{ height: `${share}%` }}
              >
                {lit && !compact ? (
                  <span
                    className={cn(
                      "absolute bottom-full mb-2",
                      tooltip,
                      edge < 0.15
                        ? "left-0"
                        : edge > 0.85
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {label(index)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {compact && highlight !== null && daily[highlight]!.salesCents > 0 ? (
        <span className={cn("absolute top-0 right-0", tooltip)}>{label(highlight)}</span>
      ) : null}
      {compact ? null : (
        <div aria-hidden className={cn("mt-3 flex h-4", many ? "gap-0-5" : "gap-1")}>
          {daily.map((day, index) => (
            <span key={day.date} className="min-w-0 flex-1 overflow-visible">
              {index % step === 0 ? (
                <span className="block type-label-s whitespace-nowrap text-text-tertiary">
                  {formatShortDayMonth(brasiliaDay(day.date))}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Figma: Visão geral of the Painel (284:1571; phone 291:2431): tickets sold and sales of the
 * period against the previous one, and the sales per day.
 */
export function SalesOverview({
  summary,
  period,
  updated,
  published,
  className,
}: OverviewProps & { className?: string }) {
  const days = periodDays[period];
  const tickets = summary?.tickets ?? 0;
  const sales = summary?.salesCents ?? 0;
  const previous = summary?.previous ?? { tickets: 0, salesCents: 0 };

  return (
    <section
      aria-label="Visão geral"
      className={cn(
        "flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5 md:gap-6 md:p-6",
        className,
      )}
    >
      <div className="hidden items-center justify-between gap-3 md:flex">
        <h2 className="type-heading-h4 text-text-primary">Visão geral</h2>
        <span className="type-body-s text-text-tertiary">{updated}</span>
      </div>

      <div className="hidden gap-4 md:flex">
        <StatCard
          icon={<Ticket aria-hidden />}
          label="Ingressos vendidos"
          value={
            summary === null ? null : (
              <span className="type-numeric-display text-text-primary">{tickets}</span>
            )
          }
          comparison={<Comparison current={tickets} previous={previous.tickets} days={days} />}
        />
        <StatCard
          icon={<Wallet aria-hidden />}
          label="Vendas"
          highlighted
          value={summary === null ? null : <SalesValue cents={sales} />}
          comparison={<Comparison current={sales} previous={previous.salesCents} days={days} />}
        />
      </div>

      <div className="flex flex-col gap-5 md:hidden">
        <MobileStat
          icon={<Wallet aria-hidden />}
          label="Vendas"
          trend={<MobileTrend current={sales} previous={previous.salesCents} />}
          value={summary === null ? null : <SalesValue cents={sales} compact />}
        />
        <div role="separator" className="h-px bg-border-subtle" />
        <MobileStat
          icon={<Ticket aria-hidden />}
          label="Ingressos vendidos"
          trend={<MobileTrend current={tickets} previous={previous.tickets} />}
          value={
            summary === null ? null : (
              <span className="type-heading-h1 text-text-primary">{tickets}</span>
            )
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="type-body-s text-text-secondary md:type-body-m-strong md:text-text-primary">
            Vendas por dia
          </h3>
          <span className="type-body-s text-text-tertiary">
            <span className="md:hidden">{days} dias</span>
            <span className="hidden md:inline">Últimos {days} dias</span>
          </span>
        </div>
        <div className="hidden md:block">
          <SalesChart summary={summary} period={period} compact={false} published={published} />
        </div>
        <div className="md:hidden">
          <SalesChart summary={summary} period={period} compact published={published} />
        </div>
      </div>
    </section>
  );
}
