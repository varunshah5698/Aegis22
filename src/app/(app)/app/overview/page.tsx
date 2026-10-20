import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CircleDollarSign, Gauge, Inbox, Radio, ShieldAlert, TriangleAlert } from "lucide-react";

import { RefreshButton } from "@/components/app/refresh-button";
import { MetricRow, PageSection, PageShell, SectionLink } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { RiskMixDonut } from "@/components/charts/risk-mix-donut";
import { ShareBars } from "@/components/charts/share-bars";
import { SeverityLadder, SlaStrip } from "@/components/charts/status-mix";
import { ValueTrendChart, type ValueCallout } from "@/components/charts/value-trend-chart";
import { InsightHero } from "@/components/dashboard/insight-hero";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MiniFeed } from "@/components/dashboard/mini-feed";
import { RiskBadge } from "@/components/risk-badge";
import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { buildFindings, describeFinding } from "@/lib/analytics/findings";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { getOpenAlertSummary, getOverviewKpis, getRecentTransactions } from "@/lib/data/overview";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

function slaLabel(dueAt: string | null, createdAt: string) {
  const created = new Date(createdAt);
  const ageMinutes = Math.max(0, Math.round((Date.now() - created.getTime()) / 60_000));
  const age = ageMinutes < 60 ? `${ageMinutes}m` : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`;
  if (!dueAt) return { text: `open ${age}`, tone: "text-muted-foreground", progress: 0 };
  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining <= 0) return { text: `SLA breached · open ${age}`, tone: "text-risk-critical", progress: 100 };
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const window = Math.max(1, 24 * 3_600_000);
  return {
    text: `${hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} left · open ${age}`,
    tone: hours >= 6 ? "text-muted-foreground" : "text-risk-medium",
    progress: Math.min(100, Math.max(4, ((window - remaining) / window) * 100)),
  };
}

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

  const [analytics, recent, alerts, kpis] = await Promise.all([
    getWorkspaceAnalytics(supabase, organizationId, range),
    getRecentTransactions(supabase, organizationId, 8),
    getOpenAlertSummary(supabase, organizationId),
    getOverviewKpis(supabase, organizationId),
  ]);

  const { totals, series, corridors, alerts: alertRollup, cases, riskMix } = analytics;
  const windowLabel = rangeLabel.toLowerCase();

  const findings = buildFindings({
    range,
    bucket: analytics.bucket,
    series,
    totals,
    corridors,
    alerts: alertRollup,
  });

  const calloutFinding = findings.find((finding) => finding.period && finding.metric) ?? null;
  const callout: ValueCallout | null =
    calloutFinding && calloutFinding.metric && calloutFinding.period
      ? {
          title: calloutFinding.title,
          label: calloutFinding.period.label,
          detail:
            `${calloutFinding.metric.unit === "usd" ? "Screened value" : "Recorded volume"} was ` +
            `${Math.abs(calloutFinding.metric.deviationPct).toFixed(0)}% ` +
            `${calloutFinding.metric.deviationPct >= 0 ? "higher" : "lower"} than the trailing median.`,
          observed: calloutFinding.metric.observed,
          baseline: calloutFinding.metric.baseline,
          unit: calloutFinding.metric.unit,
          href: calloutFinding.href,
        }
      : null;

  const topSignal = analytics.signals[0];
  const highRiskShare =
    (riskMix.filter((entry) => entry.level === "high" || entry.level === "critical").reduce((sum, entry) => sum + entry.count, 0) /
      Math.max(1, totals.count)) *
    100;

  const insightContext = [
    corridors[0]
      ? {
          label: `${corridors[0].corridor} share of value`,
          share: (corridors[0].value / Math.max(1, totals.value)) * 100,
          detail: `${corridors[0].count} payments · ${corridors[0].flagged} flagged`,
        }
      : null,
    {
      label: "Flagged share of volume",
      share: totals.flaggedShare,
      detail: `${totals.flagged} of ${totals.count} payments at or above cutoff ${SCORE_BANDS.alert}`,
    },
    {
      label: "High and critical share",
      share: highRiskShare,
      detail: "Share of scored payments in the two highest risk bands",
    },
    alertRollup.open > 0
      ? {
          label: "Open alerts unassigned",
          share: (alertRollup.unassigned / alertRollup.open) * 100,
          detail: `${alertRollup.unassigned} of ${alertRollup.open} open alerts`,
        }
      : null,
  ].filter((entry): entry is { label: string; share: number; detail: string } => entry !== null);

  const refreshedAt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date());

  return (
    <PageShell
      eyebrow="Monitoring"
      title="Overview"
      description={`Live scoring health, exposure and queue pressure for ${organization!.name}. Every figure is derived from scored payments in UTC.`}
      meta={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-risk-low/25 bg-risk-low/[0.07] px-2 py-0.5 text-risk-low">
            <Radio className="size-3" aria-hidden="true" /> Scoring live
          </span>
          <span className="chip">
            <span className="num text-foreground/85">{kpis.scannedToday.toLocaleString("en-US")}</span> scored ·{" "}
            <span className="num text-foreground/85">{kpis.flaggedToday.toLocaleString("en-US")}</span> flagged in 24h
          </span>
          <span className="chip">
            window {rangeLabel} · latency p50 <span className="num">{totals.latencyP50} ms</span>
          </span>
          <span className="chip hidden md:inline-flex">
            model {MODEL_VERSION} · cutoff <span className="num">{SCORE_BANDS.alert}</span> ·{" "}
            {profile.timezone.replace(/_/g, " ")}
          </span>
        </>
      }
      actions={
        <>
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            Updated <span className="num">{refreshedAt}</span> UTC
            <RefreshButton />
          </span>
          <RangeTabs basePath="/app/overview" current={range} />
        </>
      }
    >
      <MetricRow>
        <KpiCard
          label="Value screened"
          value={`$${formatCompactNumber(totals.value)}`}
          icon={CircleDollarSign}
          change={analytics.deltas.value}
          neutral
          spark={series.map((point) => point.value)}
          hint={`avg ${formatCurrency(totals.value / Math.max(1, totals.count), "USD", { maximumFractionDigits: 0 })} ticket`}
          definition="USD base value of scored payments in the window, converted at ingestion. The comparison is the immediately preceding window of equal length; it is not an FX market quote."
        />
        <KpiCard
          label="Payments scored"
          value={totals.count.toLocaleString("en-US")}
          icon={Activity}
          change={analytics.deltas.count}
          neutral
          spark={series.map((point) => point.count)}
          hint={`${totals.corridors} corridors`}
          definition="Payments scored in the selected window. The comparison is the immediately preceding window of equal length."
        />
        <KpiCard
          label="Flagged for review"
          value={totals.flagged.toLocaleString("en-US")}
          icon={ShieldAlert}
          change={analytics.deltas.flagged}
          invert
          tone={totals.flagged > 0 ? "warning" : "positive"}
          spark={series.map((point) => point.flagged)}
          hint={`$${formatCompactNumber(totals.flaggedValue)} exposed`}
          definition={`Payments scoring at or above the alert cutoff of ${SCORE_BANDS.alert}. A fall is an improvement, so the trend is inverted.`}
          href="/app/alerts"
        />
        <KpiCard
          label="Average risk score"
          value={totals.avgScore.toFixed(1)}
          icon={Gauge}
          comparison={`median ${totals.medianScore} · p90 ${totals.scoreP90}`}
          spark={series.map((point) => point.avgScore)}
          hint={`${highRiskShare.toFixed(1)}% high or critical`}
          definition="Mean score of scored payments in the window. Median and p90 describe the same distribution; the sparkline traces the per-bucket average score."
        />
        <KpiCard
          label="Open alerts"
          value={alertRollup.open.toLocaleString("en-US")}
          icon={Inbox}
          tone={alertRollup.breached > 0 ? "critical" : alertRollup.open > 0 ? "warning" : "positive"}
          comparison={`${alertRollup.unassigned} unassigned · ${alertRollup.breached} breached`}
          hint={`${alertRollup.total} raised in window`}
          definition="Alerts in new, investigating or escalated status right now — not limited to the selected window. SLA pressure is measured against the configured 4–48h targets."
          href="/app/alerts"
        />
      </MetricRow>

      <div className="workspace-row">
        <PageSection
          id="value-heading"
          className="xl:col-span-8"
          title="Screened value over time"
          description={`${rangeLabel} window · measured anomalies shaded, trailing median dashed`}
          action={<SectionLink href={`/app/analytics?range=${range}`}>Full analysis</SectionLink>}
          bodyClassName="px-4 pb-3 pt-3.5"
        >
          <ValueTrendChart series={series} callout={callout} bucket={analytics.bucket} height={308} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-3 sm:grid-cols-4">
            {[
              { label: "Window value", value: `$${formatCompactNumber(totals.value)}` },
              {
                label: "Average ticket",
                value: formatCurrency(totals.value / Math.max(1, totals.count), "USD", { maximumFractionDigits: 0 }),
              },
              { label: "Flagged value", value: `$${formatCompactNumber(totals.flaggedValue)}`, tone: "text-risk-high" },
              { label: "Active corridors", value: totals.corridors.toLocaleString("en-US") },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
                <p className={cn("num mt-0.5 text-[13px] font-medium leading-5", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
        </PageSection>

        <InsightHero
          findings={findings}
          range={range}
          windowLabel={windowLabel}
          context={insightContext}
          className="xl:col-span-4"
        />
      </div>

      <div className="workspace-row">
        <PageSection
          id="corridor-heading"
          className="xl:col-span-4"
          title="Corridor concentration"
          description="Share of screened value · select to open payments"
          action={<SectionLink href={`/app/corridors?range=${range}`}>All corridors</SectionLink>}
        >
          <ShareBars
            items={corridors.slice(0, 5).map((corridor) => ({
              key: corridor.corridor,
              label: corridor.corridor,
              href: `/app/transactions?corridor=${encodeURIComponent(corridor.corridor)}`,
              value: corridor.value,
              display: `$${formatCompactNumber(corridor.value)}`,
              share: (corridor.value / Math.max(1, totals.value)) * 100,
              detail: `${corridor.corridor} · ${corridor.count} payments · avg score ${corridor.avgScore} · ${corridor.flagged} flagged`,
            }))}
          />
          {corridors[0] ? (
            <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
              <span className="num font-medium text-foreground">{corridors[0].corridor}</span> leads on value with{" "}
              <span className="num">{corridors[0].count}</span> payments and{" "}
              <span className={cn("num", corridors[0].flagged > 0 && "text-risk-high")}>{corridors[0].flagged} flagged</span>.
            </p>
          ) : null}
        </PageSection>

        <PageSection
          id="mix-heading"
          className="xl:col-span-4"
          title="Risk composition"
          description="Scored volume per band against the alert cutoff"
          action={<SectionLink href={`/app/analytics?range=${range}`}>Break down</SectionLink>}
        >
          <RiskMixDonut
            mix={riskMix}
            total={totals.count}
            flagged={totals.flagged}
            flaggedShare={totals.flaggedShare}
            height={148}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
            <div>
              <p className="label-xs">Median score</p>
              <p className="num mt-1 text-[17px] font-medium leading-6">{totals.medianScore}</p>
            </div>
            <div>
              <p className="label-xs">P90 score</p>
              <p className="num mt-1 text-[17px] font-medium leading-6">{totals.scoreP90}</p>
            </div>
          </div>
          {topSignal ? (
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              <TriangleAlert className="mr-1 inline size-3 text-risk-medium" aria-hidden="true" />
              <span className="font-medium text-foreground">{topSignal.label}</span> drives{" "}
              <span className="num">{topSignal.share.toFixed(0)}%</span> of triggered signals on flagged payments.
            </p>
          ) : null}
        </PageSection>

        <PageSection
          id="findings-heading"
          className="xl:col-span-4"
          title="Recent findings"
          description="Measured deviations and queue pressure, newest evidence first"
          action={<SectionLink href={`/app/analytics?range=${range}`}>View all</SectionLink>}
          flush
        >
          {findings.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12px] leading-5 text-muted-foreground">
              No measured deviations in this window. Value, count, flagged volume and the queue all sat inside their
              baselines.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <caption className="sr-only">Recent measured findings</caption>
                <thead>
                  <tr>
                    <th scope="col" className="pl-4">Finding</th>
                    <th scope="col" className="w-[68px]">Date</th>
                    <th scope="col" className="w-[74px]">Impact</th>
                    <th scope="col" className="w-[52px] pr-4 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.slice(0, 4).map((finding) => (
                    <tr key={finding.id}>
                      <td className="max-w-[190px] pl-4">
                        <Link
                          href={finding.href}
                          className="line-clamp-2 text-[11.5px] font-medium leading-4 hover:underline"
                        >
                          {finding.title}
                        </Link>
                      </td>
                      <td className="num whitespace-nowrap text-[10.5px] text-muted-foreground">
                        {describeFinding(finding)}
                      </td>
                      <td>
                        <RiskBadge level={finding.severity} />
                      </td>
                      <td
                        className={cn(
                          "num whitespace-nowrap pr-4 text-right text-[10.5px]",
                          (finding.metric?.deviationPct ?? 0) >= 0 ? "text-risk-medium" : "text-risk-low",
                        )}
                      >
                        {finding.metric
                          ? `${finding.metric.deviationPct >= 0 ? "+" : ""}${finding.metric.deviationPct.toFixed(0)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
            {[
              { label: "Flagged", value: totals.flagged, tone: "text-risk-high" },
              { label: "Breached", value: alertRollup.breached, tone: "text-risk-critical" },
              { label: "Open cases", value: cases.open + cases.inReview, tone: "text-foreground" },
            ].map((item) => (
              <div key={item.label} className="px-4 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
                <p className={cn("num mt-1 text-[15px] font-medium leading-5", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
        </PageSection>
      </div>

      <div className="workspace-row">
        <div className="min-w-0 xl:col-span-8">
          <MiniFeed initialRows={recent} organizationId={organizationId} />
        </div>

        <PageSection
          id="queue-heading"
          className="xl:col-span-4"
          title="Queue pressure"
          description={`${alertRollup.open} open · ${alertRollup.unassigned} unassigned · sorted by severity`}
          action={<SectionLink href="/app/alerts">Queue</SectionLink>}
        >
          <SlaStrip breached={alertRollup.breached} dueSoon={alertRollup.dueSoon} open={alertRollup.open} />
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="label-xs mb-3">Backlog by severity</p>
            <SeverityLadder data={alertRollup.bySeverity} />
          </div>
          {alerts.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-border/60 pt-3.5">
              {alerts.slice(0, 3).map((alert) => {
                const sla = slaLabel(alert.due_at, alert.created_at);
                return (
                  <li key={alert.id}>
                    <Link
                      href={`/app/alerts/${alert.id}`}
                      className="flex items-center gap-2 rounded-tile border border-border/60 px-2.5 py-2 transition-colors hover:border-border-strong hover:bg-muted/30"
                    >
                      <RiskBadge level={alert.severity} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-[11.5px] font-medium">{alert.title}</span>
                        <span className={cn("mt-0.5 block text-[10.5px]", sla.tone)}>{sla.text}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
              Nothing is waiting. New detections land here.
            </p>
          )}
        </PageSection>
      </div>
    </PageShell>
  );
}
