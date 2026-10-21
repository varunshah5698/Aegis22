import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, Gauge, Inbox, ShieldAlert, Wallet } from "lucide-react";

import { RefreshButton } from "@/components/app/refresh-button";
import { TrendPill } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import {
  ScoreDistribution,
  ScoredRadar,
  WindowTrend,
  ReadoutRail,
} from "@/components/dashboard/overview-panels";
import { HourBoard } from "@/components/charts/heatmaps";
import { ActivityTable } from "@/components/dashboard/activity-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { RISK_COLORS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { getOpenAlertSummary, getRecentTransactions } from "@/lib/data/overview";
import { cn, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, profile, organization } = await requireOrganization();
  const organizationId = organization!.id;

  const [analytics, recent, alerts] = await Promise.all([
    getWorkspaceAnalytics(supabase, organizationId, range),
    getRecentTransactions(supabase, organizationId, 8),
    getOpenAlertSummary(supabase, organizationId),
  ]);

  const { totals, alerts: alertRollup } = analytics;
  const highRiskShare =
    (riskShare(analytics.riskMix) / Math.max(1, totals.count)) * 100;

  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (profile.full_name || profile.email).split(" ")[0] || "there";

  const refreshedAt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date());

  const load = alertRollup.open > 0 ? alertRollup.dueSoon + alertRollup.breached : 0;

  return (
    <div className="workspace-stack mx-auto w-full max-w-[1560px]">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] md:text-[34px]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-muted-foreground">
            Every figure below is derived from scored payments for {organization!.name}, in UTC.
          </p>
        </div>
        <div className="toolbar shrink-0">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            Updated <span className="num">{refreshedAt}</span> UTC
            <RefreshButton />
          </span>
          <RangeTabs basePath="/app/overview" current={range} />
        </div>
      </header>

      {/* Command band: headline figure, its trajectory, and a rail of the
          readouts an analyst checks first — all in one lit field. */}
      <section aria-label="Screening summary" className="overview-band">
        <div className="grid gap-0 lg:grid-cols-12">
          <div className="px-6 py-6 lg:col-span-5 lg:px-8 lg:py-8">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[9px] border border-accent/25 bg-accent/10 text-accent">
                <Wallet className="size-4" aria-hidden="true" />
              </span>
              <p className="text-[12.5px] font-medium text-muted-foreground">Total value screened</p>
              <span className="readout-pill">USD</span>
            </div>

            <p className="mt-4 font-display text-[clamp(2.9rem,6vw,4.1rem)] font-bold leading-[0.92] tracking-[-0.05em] text-foreground">
              ${formatCompactNumber(totals.value)}
            </p>

            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
              <TrendPill change={analytics.deltas.value} neutral />
              <span>against the previous {rangeLabel.toLowerCase()}</span>
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm" className="h-9 rounded-full px-4 text-[12.5px]">
                <Link href="/app/cases">New case</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-full px-4 text-[12.5px]">
                <Link href={`/app/reports?range=${range}`}>Export report</Link>
              </Button>
            </div>

            {/* Trajectory: value across the last five comparable windows. */}
            <div className="mt-7 border-t border-border/60 pt-4">
              <p className="text-[11.5px] font-medium text-muted-foreground">
                Trajectory across the last {analytics.history.windows.length + 1} windows
              </p>
              <TrajectorySpark windows={analytics.history.windows} current={totals.value} />
            </div>
          </div>

          <div className="px-6 py-6 lg:col-span-4 lg:px-8 lg:py-8 overview-band__split">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12.5px] font-medium text-muted-foreground">Score composition</p>
              <p className="text-[11.5px] text-muted-foreground">
                <span className="num font-medium text-foreground">{totals.count.toLocaleString("en-US")}</span> scored ·{" "}
                <span className={cn("num font-medium", totals.flagged > 0 ? "text-accent" : "text-risk-low")}>
                  {totals.flagged.toLocaleString("en-US")}
                </span>{" "}
                flagged
              </p>
            </div>
            <div className="mt-4 flex justify-center lg:justify-start">
              <ScoredRadar mix={analytics.riskMix} total={totals.count} />
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
              {analytics.riskMix.map((entry) => (
                <li key={entry.level} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: RISK_COLORS[entry.level] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                    {entry.level.charAt(0).toUpperCase() + entry.level.slice(1)}
                  </span>
                  <span className="num text-[12px] font-medium text-foreground">
                    {entry.count.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 py-6 lg:col-span-3 lg:px-8 lg:py-8 overview-band__split">
            <ReadoutRail
              items={[
                {
                  key: "flagged",
                  label: "Flagged value",
                  value: `$${formatCompactNumber(totals.flaggedValue)}`,
                  share: totals.value > 0 ? totals.flaggedValue / totals.value : 0,
                  color: "rgb(var(--risk-high))",
                  foot: `${totals.flagged} payments`,
                },
                {
                  key: "share",
                  label: "Flagged share of volume",
                  value: `${totals.flaggedShare.toFixed(1)}%`,
                  share: totals.flaggedShare / 100,
                  color: "rgb(var(--risk-medium))",
                  foot: `${highRiskShare.toFixed(1)}% high or critical`,
                },
                {
                  key: "load",
                  label: "Alert queue under SLA pressure",
                  value: load,
                  share: alertRollup.open > 0 ? load / alertRollup.open : 0,
                  color: alertRollup.breached > 0 ? "rgb(var(--risk-critical))" : "rgb(var(--accent))",
                  foot: `${alertRollup.open} open · ${alertRollup.breached} breached`,
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Four KPI tiles carrying the window's headline metrics with sparklines. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Payments scored"
          value={totals.count.toLocaleString("en-US")}
          icon={Activity}
          change={analytics.deltas.count}
          neutral
          hint={`${totals.corridors} corridors · ${totals.counterparties} counterparties`}
          spark={analytics.series.map((point) => point.count)}
          definition=""
        />
        <KpiCard
          label="Flagged value"
          value={`$${formatCompactNumber(totals.flaggedValue)}`}
          icon={ShieldAlert}
          change={analytics.deltas.flagged}
          invert
          tone="accent"
          hint={`${totals.flagged} payments above cutoff`}
          spark={analytics.series.map((point) => point.flaggedValue)}
          definition=""
        />
        <KpiCard
          label="Average risk score"
          value={totals.avgScore.toFixed(1)}
          icon={Gauge}
          hint={`${highRiskShare.toFixed(1)}% high or critical`}
          comparison={`median ${totals.medianScore} · p90 ${totals.scoreP90}`}
          spark={analytics.series.map((point) => point.avgScore)}
          definition=""
        />
        <KpiCard
          label="Open alerts"
          value={alertRollup.open.toLocaleString("en-US")}
          icon={Inbox}
          tone={alertRollup.breached > 0 ? "critical" : alertRollup.open > 0 ? "warning" : "positive"}
          hint={`${alertRollup.total} raised in window`}
          comparison={`${alertRollup.unassigned} unassigned · ${alertRollup.breached} breached`}
          definition=""
        />
      </div>

      {/* Statistical band: trend, distribution, and cadence. */}
      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        <section aria-labelledby="trend-heading" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="trend-heading" className="panel-title text-[14px]">
              Screened vs flagged value
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              {rangeLabel}, USD base at ingestion
            </p>
            <div className="mt-2.5 flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-sm bg-[rgb(var(--chart-1))]" aria-hidden="true" /> Screened
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-sm bg-risk-critical" aria-hidden="true" /> Flagged
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <WindowTrend series={analytics.series} />
          </div>
        </section>

        <section aria-labelledby="dist-heading" className="panel flex min-w-0 flex-col xl:col-span-4">
          <div className="px-5 pb-1 pt-5">
            <h2 id="dist-heading" className="panel-title text-[14px]">
              Risk score distribution
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Where this window's payments sit against the cutoff
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <ScoreDistribution
              distribution={analytics.distribution}
              avgScore={totals.avgScore}
              medianScore={totals.medianScore}
              p90={totals.scoreP90}
            />
          </div>
        </section>

        <section aria-labelledby="board-heading" className="panel flex min-w-0 flex-col xl:col-span-3">
          <div className="px-5 pb-1 pt-5">
            <h2 id="board-heading" className="panel-title text-[14px]">
              Screening cadence
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Payments by weekday and hour, UTC
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <HourBoard counts={analytics.board.counts} peak={analytics.board.peak} />
          </div>
        </section>
      </div>

      <div className="min-w-0">
        <ActivityTable rows={recent} />
      </div>

      {/* Keep the open-alert links reachable from the overview without adding
          another card: a quiet strip under the bento. */}
      {alerts.length > 0 ? (
        <section aria-label="Highest severity open alerts" className="flex flex-wrap items-center gap-2 pb-1">
          <span className="text-[11px] font-medium text-muted-foreground">Top of queue</span>
          {alerts.slice(0, 3).map((alert) => (
            <Link
              key={alert.id}
              href={`/app/alerts/${alert.id}`}
              className="group inline-flex min-w-0 items-center gap-2 rounded-pill border border-border/70 bg-card px-3 py-1.5 text-[11.5px] shadow-sm transition-colors hover:border-border-strong hover:bg-muted/60"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  alert.severity === "critical"
                    ? "bg-risk-critical"
                    : alert.severity === "high"
                      ? "bg-risk-high"
                      : alert.severity === "medium"
                        ? "bg-risk-medium"
                        : "bg-risk-low",
                )}
                aria-hidden="true"
              />
              <span className="max-w-[240px] truncate font-medium group-hover:underline">{alert.title}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * A small stepped spark across the last five windows so the headline figure
 * carries its own direction, not just a percentage against the last window.
 */
function TrajectorySpark({
  windows,
  current,
}: {
  windows: Array<{ label: string; value: number }>;
  current: number;
}) {
  const values = [...windows.map((window) => window.value), current];
  const max = Math.max(1, ...values);
  return (
    <div className="mt-3 flex items-end gap-1.5" aria-hidden="true">
      {values.map((value, index) => {
        const isCurrent = index === values.length - 1;
        return (
          <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                "w-full rounded-t-[3px]",
                isCurrent ? "bg-[rgb(var(--accent))]" : "bg-[rgb(var(--accent)/0.3)]",
              )}
              style={{ height: `${Math.max(6, (value / max) * 44)}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function riskShare(mix: Array<{ level: string; count: number }>) {
  return mix
    .filter((entry) => entry.level === "high" || entry.level === "critical")
    .reduce((sum, entry) => sum + entry.count, 0);
}
