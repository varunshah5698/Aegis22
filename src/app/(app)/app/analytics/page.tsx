import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Clock3, FolderOpen } from "lucide-react";

import { MetricRow, MetricTile, PageSection, PageShell, SectionLink, Sparkline } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { BarList } from "@/components/charts/bar-list";
import { CorridorHeatGrid, HourBoard } from "@/components/charts/heatmaps";
import { CorridorMatrix } from "@/components/charts/corridor-matrix";
import { FlowChart } from "@/components/charts/flow-chart";
import { RiskMixDonut } from "@/components/charts/risk-mix-donut";
import { ScoreBands } from "@/components/charts/score-bands";
import { SeverityLadder, StatusMix } from "@/components/charts/status-mix";
import { AnalystPanel } from "@/components/dashboard/analyst-panel";
import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, organization } = await requireOrganization();
  const organizationId = organization!.id;

  const analytics = await getWorkspaceAnalytics(supabase, organizationId, range);
  const { totals, series, alerts, cases } = analytics;

  const worstCorridor = analytics.corridors.reduce(
    (worst, corridor) => (corridor.avgScore > (worst?.avgScore ?? -1) ? corridor : worst),
    analytics.corridors[0],
  );
  const peakSeriesPoint = series.reduce(
    (peak, point) => (point.count > (peak?.count ?? -1) ? point : peak),
    series[0],
  );
  const latencyShare = analytics.latency.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <PageShell
      eyebrow="Analysis"
      title="Analytics"
      description={`Flow, risk composition and investigative load for ${organization!.name} across the selected window. Every figure is derived from scored payments in UTC.`}
      actions={<RangeTabs basePath="/app/analytics" current={range} />}
      meta={
        <>
          <span className="chip">
            window {rangeLabel} · {series.length} buckets
          </span>
          <span className="chip">
            <span className="num">{totals.corridors}</span> corridors ·{" "}
            <span className="num">{formatCompactNumber(totals.counterparties)}</span> payers
          </span>
          <span className="chip">
            model {MODEL_VERSION} · cutoff {SCORE_BANDS.alert}
          </span>
          {peakSeriesPoint ? (
            <span className="chip">
              busiest {analytics.bucket === "hour" ? "hour" : "day"} {peakSeriesPoint.label} ·{" "}
              <span className="num">{peakSeriesPoint.count}</span> payments
            </span>
          ) : null}
          {analytics.history.baseline.windows > 0 ? (
            <span className="chip">
              trailing median <span className="num">{analytics.history.baseline.count.toLocaleString("en-US")}</span>{" "}
              payments · <span className="num">{analytics.history.baseline.flagged}</span> flagged across{" "}
              <span className="num">{analytics.history.baseline.windows}</span> windows
            </span>
          ) : null}
        </>
      }
    >
      <MetricRow>
        <MetricTile
          label="Payments scored"
          value={totals.count.toLocaleString("en-US")}
          change={analytics.deltas.count}
          neutralTrend
          spark={series.map((point) => point.count)}
          hint={`previous window ${analytics.previous.count.toLocaleString("en-US")}`}
        />
        <MetricTile
          label="Value screened"
          value={`$${formatCompactNumber(totals.value)}`}
          change={analytics.deltas.value}
          neutralTrend
          spark={series.map((point) => point.value)}
          hint={`${formatCurrency(totals.value / Math.max(1, totals.count), "USD", { maximumFractionDigits: 0 })} average ticket`}
        />
        <MetricTile
          label="Flagged for review"
          value={totals.flagged.toLocaleString("en-US")}
          change={analytics.deltas.flagged}
          invert
          tone={totals.flagged > 0 ? "warning" : "positive"}
          hint={`${totals.flaggedShare.toFixed(2)}% of volume · ${formatCompactNumber(totals.flaggedValue)} USD exposed`}
        />
        <MetricTile
          label="Score profile"
          value={`${totals.medianScore} / ${totals.scoreP90}`}
          tone="accent"
          hint={`median / p90 · average ${totals.avgScore}`}
          spark={series.map((point) => point.avgScore)}
        />
      </MetricRow>

      <AnalystPanel range={range} page="analytics" />

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="flow-heading"
          className="xl:col-span-9"
          title="Flow and risk over time"
          description={`Payments by risk band per ${analytics.bucket === "hour" ? "hour" : "day"} with the average score traced across the window`}
          footnote={
            peakSeriesPoint
              ? `Peak volume ${peakSeriesPoint.label} with ${peakSeriesPoint.count} payments and ${peakSeriesPoint.flagged} above the cutoff.`
              : undefined
          }
          bodyClassName="px-5 pb-4 pt-4"
        >
          <FlowChart series={series} height={330} />
        </PageSection>

        <PageSection
          id="mix-heading"
          className="xl:col-span-3"
          title="Risk composition"
          description="Share of scored volume per band"
        >
          <RiskMixDonut
            mix={analytics.riskMix}
            total={totals.count}
            flagged={totals.flagged}
            flaggedShare={totals.flaggedShare}
            height={168}
          />
          <dl className="mt-4 space-y-2.5 border-t border-border/60 pt-4 text-[11.5px]">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Average score</dt>
              <dd className="num font-medium">{totals.avgScore}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Median score</dt>
              <dd className="num font-medium">{totals.medianScore}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Median detection</dt>
              <dd className="num font-medium">{totals.latencyP50} ms</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">P95 detection</dt>
              <dd className="num font-medium">{totals.latencyP95} ms</dd>
            </div>
          </dl>
        </PageSection>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="distribution-heading"
          className="xl:col-span-7"
          title="Score distribution"
          description={`${totals.count.toLocaleString("en-US")} scored payments in ten bands, measured against the cutoff`}
        >
          <ScoreBands bins={analytics.distribution} threshold={SCORE_BANDS.alert} height={212} />
        </PageSection>

        <PageSection
          id="timing-heading"
          className="xl:col-span-5"
          title="Operating cadence"
          description="Payment count by UTC weekday and hour"
        >
          <HourBoard counts={analytics.board.counts} peak={analytics.board.peak} />
        </PageSection>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="corridor-heat-heading"
          className="xl:col-span-7"
          title="Corridor exposure over time"
          description="Average score per corridor per period for the busiest corridors"
          action={<SectionLink href={`/app/corridors?range=${range}`}>Corridor workspace</SectionLink>}
        >
          <CorridorHeatGrid matrix={analytics.matrix} />
          {worstCorridor ? (
            <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
              Highest average score in window:{" "}
              <Link
                href={`/app/transactions?corridor=${worstCorridor.corridor}`}
                className="num font-medium text-foreground hover:underline"
              >
                {worstCorridor.corridor}
              </Link>{" "}
              at <span className="num">{worstCorridor.avgScore}</span> across{" "}
              <span className="num">{worstCorridor.count}</span> payments.
            </p>
          ) : null}
        </PageSection>

        <PageSection
          id="signals-heading"
          className="xl:col-span-5"
          title="Signal frequency"
          description="Model signals triggered on flagged payments, with their weight contribution"
        >
          <BarList
            items={analytics.signals.slice(0, 8).map((signal) => ({
              key: signal.id,
              label: signal.label,
              value: signal.count,
              display: `${signal.count.toLocaleString("en-US")} · ${signal.share.toFixed(0)}%`,
              secondary: `${signal.points} pts`,
              hint: signal.label,
            }))}
            barClassName="bg-accent/80"
            emptyMessage="No signals fired for flagged payments in this window."
          />
        </PageSection>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="outcomes-heading"
          className="xl:col-span-4"
          title="Alert outcomes"
          description={`${alerts.total} alerts raised in the window · ${alerts.open} still open`}
          action={<SectionLink href="/app/alerts">Queue</SectionLink>}
        >
          <StatusMix data={alerts.byStatus} total={alerts.total} />
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="label-xs mb-3">Backlog by severity</p>
            <SeverityLadder data={alerts.bySeverity} />
          </div>
        </PageSection>

        <PageSection
          id="latency-heading"
          className="xl:col-span-4"
          title="Detection latency"
          description={`Distribution of scoring time across ${latencyShare.toLocaleString("en-US")} scored payments`}
        >
          <BarList
            items={analytics.latency.map((entry) => ({
              key: entry.bucket,
              label: <span className="num">{entry.bucket} ms</span>,
              value: entry.count,
              display: entry.count.toLocaleString("en-US"),
              secondary: `${((entry.count / Math.max(1, latencyShare)) * 100).toFixed(0)}%`,
              color: "rgb(var(--chart-4))",
            }))}
            emptyMessage="Latency samples are not available for this window."
          />
          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            Median <span className="num">{totals.latencyP50} ms</span> · p95{" "}
            <span className="num">{totals.latencyP95} ms</span>. Latency is the scored-on-arrival time recorded with each
            decision.
          </p>
        </PageSection>

        <PageSection
          id="load-heading"
          className="xl:col-span-4"
          title="Investigative load"
          description="Case throughput and the analysts' queue in this window"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Open cases", value: cases.open, icon: FolderOpen, tone: "text-foreground" },
              { label: "In review", value: cases.inReview, icon: Activity, tone: "text-risk-medium" },
              { label: "Closed", value: cases.closed, icon: FolderOpen, tone: "text-risk-low" },
              {
                label: "Median close",
                value: alerts.medianResolutionHours !== null ? `${alerts.medianResolutionHours}h` : "—",
                icon: Clock3,
                tone: "text-foreground",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-tile border border-border/70 bg-elevated/50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <item.icon className="size-3" aria-hidden="true" />
                  {item.label}
                </p>
                <p className={cn("num mt-1.5 text-[20px] font-medium leading-6", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2 border-t border-border/60 pt-3.5 text-[11.5px]">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Alerts unassigned</span>
              <span className="num">{alerts.unassigned}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">SLA breached</span>
              <span className={cn("num", alerts.breached > 0 && "text-risk-critical")}>{alerts.breached}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Cases opened in window</span>
              <span className="num">{cases.openedInRange}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Total cases</span>
              <span className="num">{cases.total}</span>
            </li>
          </ul>
        </PageSection>
      </div>

      <PageSection
        id="matrix-heading"
        className="xl:col-span-12"
        title="Sender and receiver risk map"
        description="Average score per country pair across the selected window; select a cell to open the matching payments"
      >
        <CorridorMatrix
          corridors={analytics.corridors.map((corridor) => ({
            corridor: corridor.corridor,
            senderCountry: corridor.senderCountry,
            receiverCountry: corridor.receiverCountry,
            count: corridor.count,
            value: corridor.value,
            flagged: corridor.flagged,
            averageScore: corridor.avgScore,
          }))}
        />
      </PageSection>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="corridors-heading"
          className="xl:col-span-8"
          title="Corridor performance"
          description="Ranked by screened value with the flagged share and period trend"
          flush
        >
          <div className="overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <caption className="sr-only">Corridor performance in the selected window</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5">Corridor</th>
                  <th scope="col" className="text-right">Payments</th>
                  <th scope="col" className="text-right">Value (USD)</th>
                  <th scope="col" className="text-right">Share</th>
                  <th scope="col" className="text-right">Flagged</th>
                  <th scope="col" className="text-right">Avg score</th>
                  <th scope="col" className="pr-5 text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {analytics.corridors.slice(0, 12).map((corridor) => (
                  <tr key={corridor.corridor}>
                    <th scope="row" className="pl-5 text-left font-normal">
                      <Link
                        href={`/app/transactions?corridor=${corridor.corridor}`}
                        className="num hover:underline"
                      >
                        {corridor.corridor}
                      </Link>
                    </th>
                    <td className="num text-right">{corridor.count.toLocaleString("en-US")}</td>
                    <td className="num text-right">{formatCompactNumber(corridor.value)}</td>
                    <td className="num text-right text-muted-foreground">{corridor.share.toFixed(1)}%</td>
                    <td className={cn("num text-right", corridor.flagged > 0 && "text-risk-high")}>
                      {corridor.flagged}
                    </td>
                    <td className="num text-right">{corridor.avgScore}</td>
                    <td className="pr-5">
                      <span className="flex justify-end text-accent/70">
                        <Sparkline values={corridor.spark} className="h-5 w-16" fill={false} strokeWidth={1.4} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection
          id="mix-summary-heading"
          className="xl:col-span-4"
          title="Settlement and concentration"
          description="Currency mix and the largest payers by screened value"
        >
          <BarList
            items={analytics.currencies.map((entry) => ({
              key: entry.currency,
              label: <span className="num">{entry.currency}</span>,
              value: entry.value,
              display: `${formatCompactNumber(entry.value)} USD`,
              secondary: `${entry.count} pmts`,
              color: "rgb(var(--chart-2))",
            }))}
          />
          <ul className="mt-5 space-y-2.5 border-t border-border/60 pt-4">
            {analytics.peers.slice(0, 5).map((peer) => (
              <li key={peer.name} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                <span className="min-w-0 truncate text-foreground/90" title={peer.name}>
                  {peer.name}
                </span>
                <span className="num shrink-0 text-muted-foreground">
                  {formatCompactNumber(peer.value)} USD · avg {peer.avgScore}
                  {peer.flagged > 0 ? <span className="text-risk-high"> · {peer.flagged} flagged</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </PageSection>
      </div>
    </PageShell>
  );
}
