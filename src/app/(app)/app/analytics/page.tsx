import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Banknote,
  CircleDollarSign,
  Clock3,
  FolderOpen,
  Gauge,
  TriangleAlert,
} from "lucide-react";

import {
  MetricRow,
  MetricTile,
  PageSection,
  PageShell,
  SectionLink,
  Sparkline,
} from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { BarList } from "@/components/charts/bar-list";
import { CorridorHeatGrid, HourBoard } from "@/components/charts/heatmaps";
import { CorridorMatrix } from "@/components/charts/corridor-matrix";
import { FlowChart } from "@/components/charts/flow-chart";
import { RiskMixDonut } from "@/components/charts/risk-mix-donut";
import { BandStrip, ScoreBands } from "@/components/charts/score-bands";
import { SeverityLadder, SlaStrip, StatusMix } from "@/components/charts/status-mix";;
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

  // Cadence summary: where the week's volume actually sits, derived from the
  // same weekday × hour board the heatmap draws.
  const weekdayTotals = analytics.board.counts.map((hours) =>
    hours.reduce((sum, count) => sum + count, 0),
  );
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const busiestDay = weekdayTotals.length
    ? weekdayTotals.reduce(
        (best, total, index) => (total > (weekdayTotals[best] ?? -1) ? index : best),
        0,
      )
    : -1;
  const quietestDay = weekdayTotals.length
    ? weekdayTotals.reduce(
        (best, total, index) => (total < (weekdayTotals[best] ?? Number.MAX_SAFE_INTEGER) ? index : best),
        0,
      )
    : -1;
  const boardTotal = weekdayTotals.reduce((sum, total) => sum + total, 0);
  const offHoursCount = analytics.board.counts.reduce(
    (sum, hours) => sum + hours.slice(0, 6).reduce((part, count) => part + count, 0),
    0,
  );
  const offHoursShare = boardTotal > 0 ? (offHoursCount / boardTotal) * 100 : 0;

  // The band immediately under the line — the one most likely to cross it.
  const nearCutoff = analytics.distribution.find(
    (bin) => bin.low < SCORE_BANDS.alert && bin.high >= SCORE_BANDS.alert - 10,
  );

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
              trailing median{" "}
              <span className="num">
                {analytics.history.baseline.count.toLocaleString("en-US")}
              </span>{" "}
              payments · <span className="num">{analytics.history.baseline.flagged}</span> flagged
              across <span className="num">{analytics.history.baseline.windows}</span> windows
            </span>
          ) : null}
        </>
      }
    >
      <MetricRow>
        <MetricTile
          icon={Banknote}
          label="Payments scored"
          value={totals.count.toLocaleString("en-US")}
          change={analytics.deltas.count}
          neutralTrend
          spark={series.map((point) => point.count)}
          hint={`previous window ${analytics.previous.count.toLocaleString("en-US")}`}
        />
        <MetricTile
          icon={CircleDollarSign}
          label="Value screened"
          value={`$${formatCompactNumber(totals.value)}`}
          change={analytics.deltas.value}
          neutralTrend
          spark={series.map((point) => point.value)}
          hint={`${formatCurrency(totals.value / Math.max(1, totals.count), "USD", { maximumFractionDigits: 0 })} average ticket`}
        />
        <MetricTile
          icon={TriangleAlert}
          label="Flagged for review"
          value={totals.flagged.toLocaleString("en-US")}
          change={analytics.deltas.flagged}
          invert
          tone={totals.flagged > 0 ? "warning" : "positive"}
          hint={`${totals.flaggedShare.toFixed(2)}% of volume · ${formatCompactNumber(totals.flaggedValue)} USD exposed`}
        />
        <MetricTile
          icon={Gauge}
          label="Score profile"
          value={`${totals.medianScore} / ${totals.scoreP90}`}
          tone="accent"
          hint={`median / p90 · average ${totals.avgScore}`}
          spark={series.map((point) => point.avgScore)}
        />
      </MetricRow>

      <AnalystPanel range={range} page="analytics" scope={organizationId} />

      <div className="workspace-row">
        <PageSection
          id="flow-heading"
          className="xl:col-span-8"
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
          className="xl:col-span-4"
          title="Risk composition"
          description="Share of scored volume per band"
        >
          <RiskMixDonut
            mix={analytics.riskMix}
            total={totals.count}
            flagged={totals.flagged}
            flaggedShare={totals.flaggedShare}
            height={176}
          />

          {/* Where the middle of the book sits against the line that routes work. */}
          <div className="mt-4 border-t border-border/60 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="label-xs">Score spread</p>
              <p className="text-[11px] text-muted-foreground">
                p90 <span className="num text-foreground">{totals.scoreP90}</span> of 100
              </p>
            </div>
            <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-muted/70">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(2, totals.scoreP90)}%`,
                  background: "linear-gradient(90deg, rgb(var(--accent) / 0.35), rgb(var(--accent) / 0.85))",
                }}
                aria-hidden="true"
              />
              <span
                className="absolute inset-y-0 w-px bg-foreground/55"
                style={{ left: `${Math.min(100, SCORE_BANDS.alert)}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                median <span className="num text-foreground">{totals.medianScore}</span>
              </span>
              <span>
                avg <span className="num text-foreground">{totals.avgScore}</span>
              </span>
              <span>
                cutoff <span className="num text-foreground">{SCORE_BANDS.alert}</span>
              </span>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-4">
            {[
              { label: "Median score", value: String(totals.medianScore) },
              { label: "Average score", value: String(totals.avgScore) },
              { label: "Median detection", value: `${totals.latencyP50} ms` },
              { label: "P95 detection", value: `${totals.latencyP95} ms` },
            ].map((entry) => (
              <div
                key={entry.label}
                className="rounded-tile border border-border/70 bg-elevated/50 px-2.5 py-2"
              >
                <dt className="truncate text-[11.5px] text-muted-foreground">
                  {entry.label}
                </dt>
                <dd className="num mt-1 text-[17px] font-medium leading-5">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="signals-heading"
          className="xl:col-span-7"
          title="Signal frequency"
          description="Model signals triggered on flagged payments, with their weight contribution"
          footnote={
            analytics.signals.length > 6
              ? `Showing the 6 most frequent of ${analytics.signals.length} signals in the window.`
              : "Every flagged payment fires at least one signal."
          }
        >
          <BarList
            items={analytics.signals.slice(0, 6).map((signal) => ({
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

        <PageSection
          id="timing-heading"
          className="xl:col-span-5"
          title="Operating cadence"
          description="Payment count by UTC weekday and hour"
        >
          <HourBoard counts={analytics.board.counts} peak={analytics.board.peak} />
          <dl className="mt-3.5 grid grid-cols-3 gap-2.5 border-t border-border/60 pt-3.5">
            {[
              {
                label: "Busiest day",
                value: (busiestDay >= 0 ? weekdayNames[busiestDay] : undefined) ?? "—",
                hint:
                  busiestDay >= 0
                    ? `${(weekdayTotals[busiestDay] ?? 0).toLocaleString("en-US")} payments`
                    : undefined,
              },
              {
                label: "Quietest day",
                value: (quietestDay >= 0 ? weekdayNames[quietestDay] : undefined) ?? "—",
                hint:
                  quietestDay >= 0
                    ? `${(weekdayTotals[quietestDay] ?? 0).toLocaleString("en-US")} payments`
                    : undefined,
              },
              {
                label: "Before 06:00",
                value: `${offHoursShare.toFixed(0)}%`,
                hint: "of the window's volume",
              },
            ].map((entry) => (
              <div key={entry.label}>
                <dt className="truncate text-[11.5px] text-muted-foreground">
                  {entry.label}
                </dt>
                <dd className="num mt-1 text-[18px] font-medium leading-6">{entry.value}</dd>
                {entry.hint ? (
                  <dd className="truncate text-[11px] leading-4 text-muted-foreground">
                    {entry.hint}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="distribution-heading"
          className="xl:col-span-8"
          title="Score distribution"
          description={`${totals.count.toLocaleString("en-US")} scored payments in ten bands, measured against the cutoff`}
        >
          <ScoreBands bins={analytics.distribution} threshold={SCORE_BANDS.alert} height={212} />
          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            Bands above the <span className="num">{SCORE_BANDS.alert}</span> cutoff route to review;
            the p90 sits at <span className="num">{totals.scoreP90}</span> with{" "}
            <span className="num">{totals.flagged}</span> payments in the flagged tail.
          </p>
        </PageSection>

        <PageSection
          id="cutoff-readout-heading"
          className="xl:col-span-4"
          title="Cutoff readout"
          description="How the scored book sits against the alert line"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="metric-xl text-risk-high">{totals.flagged}</p>
              <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
                payments at or above <span className="num">{SCORE_BANDS.alert}</span>
              </p>
            </div>
            <span className="chip border-risk-high/30 bg-risk-high/10 num text-risk-high">
              {totals.flaggedShare.toFixed(2)}% of volume
            </span>
          </div>

          <div className="mt-4">
            <BandStrip bins={analytics.distribution} threshold={SCORE_BANDS.alert} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-4">
            {[
              { label: "Median score", value: String(totals.medianScore) },
              { label: "P90 score", value: String(totals.scoreP90) },
              { label: "Average score", value: String(totals.avgScore) },
              nearCutoff
                ? {
                    label: `Within 10 pts (${nearCutoff.low}–${nearCutoff.high})`,
                    value: nearCutoff.count.toLocaleString("en-US"),
                  }
                : { label: "Within 10 pts of cutoff", value: "0" },
            ].map((entry) => (
              <div
                key={entry.label}
                className="rounded-tile border border-border/70 bg-elevated/50 px-2.5 py-2"
              >
                <dt className="truncate text-[11.5px] text-muted-foreground">
                  {entry.label}
                </dt>
                <dd className="num mt-1 text-[17px] font-medium leading-5">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </PageSection>
      </div>

      <PageSection
        id="corridor-heat-heading"
        className="xl:col-span-12"
        title="Corridor exposure over time"
        description="Average score per corridor per period for the busiest corridors; darker cells carry more risk"
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

      <div className="workspace-row">
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
                  <th scope="col" className="pl-5">
                    Corridor
                  </th>
                  <th scope="col" className="text-right">
                    Payments
                  </th>
                  <th scope="col" className="text-right">
                    Value (USD)
                  </th>
                  <th scope="col" className="text-right">
                    Share
                  </th>
                  <th scope="col" className="text-right">
                    Flagged
                  </th>
                  <th scope="col" className="text-right">
                    Avg score
                  </th>
                  <th scope="col" className="pr-5 text-right">
                    Trend
                  </th>
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
                    <td className="num text-right text-muted-foreground">
                      {corridor.share.toFixed(1)}%
                    </td>
                    <td className={cn("num text-right", corridor.flagged > 0 && "text-risk-high")}>
                      {corridor.flagged}
                    </td>
                    <td className="num text-right">{corridor.avgScore}</td>
                    <td className="pr-5">
                      <span className="flex justify-end text-accent/70">
                        <Sparkline
                          values={corridor.spark}
                          className="h-5 w-16"
                          fill={false}
                          strokeWidth={1.4}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

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
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="label-xs mb-2.5">SLA health</p>
            <SlaStrip
              breached={alerts.breached}
              dueSoon={alerts.dueSoon}
              open={alerts.open}
            />
          </div>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="latency-heading"
          className="xl:col-span-7"
          title="Detection latency"
          description={`Distribution of scoring time across ${latencyShare.toLocaleString("en-US")} scored payments`}
          footnote={
            <>
              Median <span className="num">{totals.latencyP50} ms</span> · p95{" "}
              <span className="num">{totals.latencyP95} ms</span>. Latency is the scored-on-arrival
              time recorded with each decision.
            </>
          }
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
        </PageSection>

        <PageSection
          id="load-heading"
          className="xl:col-span-5"
          title="Investigative load"
          description="Case throughput and the analysts' queue in this window"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Open cases",
                value: cases.open,
                icon: FolderOpen,
                tone: "text-foreground",
                hint: `${cases.total > 0 ? Math.round((cases.open / cases.total) * 100) : 0}% of ${cases.total} total`,
              },
              {
                label: "In review",
                value: cases.inReview,
                icon: Activity,
                tone: "text-risk-medium",
                hint: "with an analyst",
              },
              {
                label: "Closed",
                value: cases.closed,
                icon: FolderOpen,
                tone: "text-risk-low",
                hint:
                  cases.total > 0
                    ? `${Math.round((cases.closed / cases.total) * 100)}% close rate`
                    : "no closures yet",
              },
              {
                label: "Median close",
                value:
                  alerts.medianResolutionHours !== null ? `${alerts.medianResolutionHours}h` : "—",
                icon: Clock3,
                tone: "text-foreground",
                hint: "hours to resolution",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-tile border border-border/70 bg-elevated/50 px-3 py-3"
              >
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <item.icon className="size-3" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </p>
                <p className={cn("num mt-1.5 text-[20px] font-medium leading-6", item.tone)}>
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>

          {/* One bar for where the book sits right now, so the queue reads at a glance. */}
          <div className="mt-4 border-t border-border/60 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="label-xs">Case queue</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="num text-foreground">{cases.openedInRange}</span> opened in window
              </p>
            </div>
            <div
              className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label="Case queue split by state"
            >
              {[
                { key: "open", value: cases.open, color: "rgb(var(--chart-3))" },
                { key: "in review", value: cases.inReview, color: "rgb(var(--chart-2))" },
                { key: "closed", value: cases.closed, color: "rgb(var(--chart-1))" },
              ].map((segment) =>
                segment.value > 0 && cases.total > 0 ? (
                  <span
                    key={segment.key}
                    style={{
                      width: `${(segment.value / cases.total) * 100}%`,
                      background: segment.color,
                    }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground">
              {[
                { key: "open", label: "Open", value: cases.open, color: "rgb(var(--chart-3))" },
                { key: "review", label: "In review", value: cases.inReview, color: "rgb(var(--chart-2))" },
                { key: "closed", label: "Closed", value: cases.closed, color: "rgb(var(--chart-1))" },
              ].map((entry) => (
                <li key={entry.key} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: entry.color }}
                    aria-hidden="true"
                  />
                  {entry.label}
                  <span className="num text-foreground/90">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-4 space-y-2 border-t border-border/60 pt-3.5 text-[11.5px]">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Alerts unassigned</span>
              <span className="num">{alerts.unassigned}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">SLA breached</span>
              <span className={cn("num", alerts.breached > 0 && "text-risk-critical")}>
                {alerts.breached}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">SLA due within 6h</span>
              <span className={cn("num", alerts.dueSoon > 0 && "text-risk-medium")}>
                {alerts.dueSoon}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Alerts open in queue</span>
              <span className="num">{alerts.open}</span>
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
        id="mix-summary-heading"
        className="xl:col-span-12"
        title="Settlement and concentration"
        description="Currency mix and the largest payers by screened value"
      >
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
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
          <ul className="space-y-2.5 lg:border-l lg:border-border/60 lg:pl-8">
            <li className="label-xs">Largest payers</li>
            {analytics.peers.slice(0, 6).map((peer) => (
              <li key={peer.name} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                <span className="min-w-0 truncate text-foreground/90" title={peer.name}>
                  {peer.name}
                </span>
                <span className="num shrink-0 text-muted-foreground">
                  {formatCompactNumber(peer.value)} USD · avg {peer.avgScore}
                  {peer.flagged > 0 ? (
                    <span className="text-risk-high"> · {peer.flagged} flagged</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </PageSection>
    </PageShell>
  );
}
