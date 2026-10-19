import type { RiskLevel } from "@/config/risk";
import type { SeriesBucket } from "@/lib/data/analytics";
import type { RangeKey } from "@/lib/data/common";

/**
 * Deterministic findings.
 *
 * The dashboard never asks a model to invent an anomaly. This module compares
 * every bucket in the selected window against a trailing median and emits
 * measured deviations, queue pressure and coverage gaps. The AI layer may then
 * explain these numbers, but it cannot change them.
 */

export type FindingKind = "value" | "count" | "flagged" | "concentration" | "backlog" | "gap";

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: RiskLevel;
  title: string;
  detail: string;
  /** Bucket the finding refers to, when it is time-scoped. */
  period: { at: string; label: string } | null;
  /** Measured figures behind the finding. */
  metric: { observed: number; baseline: number; unit: "usd" | "count"; deviationPct: number } | null;
  evidence: string[];
  /** Where the supporting rows live. */
  href: string;
}

export interface FindingsInput {
  range: RangeKey;
  bucket: "hour" | "day";
  series: SeriesBucket[];
  totals: { count: number; value: number; flagged: number; flaggedValue: number; flaggedShare: number };
  corridors: Array<{ corridor: string; count: number; value: number; flagged: number; avgScore: number }>;
  alerts: { open: number; unassigned: number; breached: number; dueSoon: number; total: number };
}

const MAX_BASELINE = 6;
const MIN_BASELINE_POINTS = 3;
const MIN_BASELINE_VALUE = 2_000;
const MIN_BASELINE_COUNT = 4;
const VALUE_DEVIATION = 0.3;
const COUNT_DEVIATION = 0.5;

const severityOrder: Record<RiskLevel, number> = { critical: 3, high: 2, medium: 1, low: 0 };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function deviation(observed: number, baseline: number): number {
  if (baseline === 0) return observed === 0 ? 0 : 1;
  return (observed - baseline) / baseline;
}

function direction(change: number): string {
  return change >= 0 ? "above" : "below";
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/**
 * A gap at the end of the series is different from a quiet window: if the most
 * recent buckets are empty while earlier buckets carried traffic, the honest
 * reading is missing ingestion, not calm.
 */
function trailingGap(series: SeriesBucket[]): { start: number; count: number } | null {
  let end = series.length - 1;
  while (end >= 0 && series[end]!.count === 0) end -= 1;
  const emptyTail = series.length - 1 - end;
  if (emptyTail >= 2 && end >= 2) {
    const earlier = series.slice(Math.max(0, end - 5), end + 1).reduce((sum, point) => sum + point.count, 0);
    if (earlier >= MIN_BASELINE_COUNT) return { start: end + 1, count: emptyTail };
  }
  return null;
}

export function buildFindings(input: FindingsInput): Finding[] {
  const findings: Finding[] = [];
  const { series, totals, corridors, alerts } = input;

  for (let index = 0; index < series.length; index += 1) {
    const point = series[index]!;
    const history = series.slice(Math.max(0, index - MAX_BASELINE), index);
    if (history.length < MIN_BASELINE_POINTS) continue;

    const baselineValue = median(history.map((entry) => entry.value));
    const baselineCount = median(history.map((entry) => entry.count));
    const baselineFlagged = median(history.map((entry) => entry.flagged));

    const valueDev = baselineValue >= MIN_BASELINE_VALUE ? deviation(point.value, baselineValue) : null;
    if (valueDev !== null && Math.abs(valueDev) >= VALUE_DEVIATION) {
      const magnitude = Math.abs(valueDev);
      findings.push({
        id: `value-${point.at}`,
        kind: "value",
        severity: magnitude >= 0.8 ? "high" : "medium",
        title: `Screened value ${Math.round(magnitude * 100)}% ${direction(valueDev)} the trailing baseline`,
        detail:
          `${point.label} carried $${Math.round(point.value).toLocaleString("en-US")} across ${countLabel(point.count, "payment")}, ` +
          `against a ${history.length}-bucket median of $${Math.round(baselineValue).toLocaleString("en-US")}.`,
        period: { at: point.at, label: point.label },
        metric: { observed: Math.round(point.value), baseline: Math.round(baselineValue), unit: "usd", deviationPct: valueDev * 100 },
        evidence: [
          `Bucket ${point.label} · ${countLabel(point.count, "payment")} · $${Math.round(point.value).toLocaleString("en-US")}`,
          `Trailing ${history.length}-bucket median · $${Math.round(baselineValue).toLocaleString("en-US")}`,
          `Average score ${point.avgScore.toFixed(1)} · ${point.flagged} flagged`,
        ],
        href: `/app/analytics?range=${input.range}`,
      });
    } else if (baselineCount >= MIN_BASELINE_COUNT) {
      const countDev = deviation(point.count, baselineCount);
      if (Math.abs(countDev) >= COUNT_DEVIATION) {
        const magnitude = Math.abs(countDev);
        findings.push({
          id: `count-${point.at}`,
          kind: "count",
          severity: magnitude >= 1 ? "high" : "medium",
          title: `Payment count ${Math.round(magnitude * 100)}% ${direction(countDev)} the trailing baseline`,
          detail: `${point.label} recorded ${countLabel(point.count, "payment")}, against a median of ${Math.round(baselineCount)} per bucket.`,
          period: { at: point.at, label: point.label },
          metric: { observed: point.count, baseline: Math.round(baselineCount), unit: "count", deviationPct: countDev * 100 },
          evidence: [
            `Bucket ${point.label} · ${countLabel(point.count, "payment")}`,
            `Trailing ${history.length}-bucket median · ${Math.round(baselineCount)}`,
          ],
          href: `/app/transactions`,
        });
      }
    }

    if (point.flagged >= 3 && point.flagged >= Math.max(2, baselineFlagged * 1.5)) {
      findings.push({
        id: `flagged-${point.at}`,
        kind: "flagged",
        severity: point.flagged >= 5 ? "critical" : "high",
        title: `${countLabel(point.flagged, "flagged payment")} landed in one bucket`,
        detail: `${point.label} produced ${point.flagged} payments at or above the alert cutoff, against a trailing median of ${Math.round(baselineFlagged)}.`,
        period: { at: point.at, label: point.label },
        metric: { observed: point.flagged, baseline: Math.round(baselineFlagged), unit: "count", deviationPct: deviation(point.flagged, baselineFlagged) * 100 },
        evidence: [
          `Bucket ${point.label} · ${point.flagged} flagged`,
          `Trailing median · ${Math.round(baselineFlagged)} flagged`,
          `Flagged value in bucket is included in the window total of $${Math.round(totals.flaggedValue).toLocaleString("en-US")}`,
        ],
        href: `/app/alerts`,
      });
    }
  }

  const topCorridor = corridors[0];
  if (topCorridor && totals.value > 0 && topCorridor.value / totals.value >= 0.4) {
    const share = (topCorridor.value / totals.value) * 100;
    findings.push({
      id: "concentration",
      kind: "concentration",
      severity: share >= 60 ? "high" : "medium",
      title: `Corridor concentration: ${topCorridor.corridor} carries ${share.toFixed(0)}% of screened value`,
      detail: `${topCorridor.corridor} routed $${Math.round(topCorridor.value).toLocaleString("en-US")} over ${countLabel(topCorridor.count, "payment")} at an average score of ${topCorridor.avgScore}.`,
      period: null,
      metric: { observed: Math.round(topCorridor.value), baseline: Math.round(totals.value), unit: "usd", deviationPct: share },
      evidence: [
        `${topCorridor.corridor} · $${Math.round(topCorridor.value).toLocaleString("en-US")} · ${countLabel(topCorridor.count, "payment")}`,
        `Window value · $${Math.round(totals.value).toLocaleString("en-US")}`,
        `${topCorridor.flagged} flagged payment${topCorridor.flagged === 1 ? "" : "s"} in this corridor`,
      ],
      href: `/app/transactions?corridor=${encodeURIComponent(topCorridor.corridor)}`,
    });
  }

  if (alerts.open > 0 && alerts.unassigned / alerts.open >= 0.9) {
    findings.push({
      id: "queue-unassigned",
      kind: "backlog",
      severity: alerts.breached > 0 ? "critical" : "medium",
      title: `${countLabel(alerts.unassigned, "open alert")} with no owner`,
      detail: `${alerts.open} alerts are open and ${alerts.unassigned} are unassigned; ${alerts.breached} have breached their SLA and ${alerts.dueSoon} fall due within six hours.`,
      period: null,
      metric: null,
      evidence: [
        `Open · ${alerts.open}`,
        `Unassigned · ${alerts.unassigned}`,
        `SLA breached · ${alerts.breached} · due < 6h · ${alerts.dueSoon}`,
      ],
      href: "/app/alerts",
    });
  }

  const gap = trailingGap(series);
  if (gap) {
    const first = series[gap.start]!;
    const last = series[series.length - 1]!;
    findings.push({
      id: "ingestion-gap",
      kind: "gap",
      severity: "high",
      title: `No payments recorded in the last ${countLabel(gap.count, "period")}`,
      detail: `The series is empty from ${first.label} to ${last.label}, after earlier buckets carried traffic. Treat this as missing ingestion before reading it as calm.`,
      period: { at: last.at, label: last.label },
      metric: { observed: 0, baseline: 1, unit: "count", deviationPct: -100 },
      evidence: [
        `First empty bucket · ${first.label}`,
        `Last bucket · ${last.label}`,
        `Payments in window · ${totals.count}`,
      ],
      href: `/app/transactions`,
    });
  }

  return findings
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || Math.abs(b.metric?.deviationPct ?? 0) - Math.abs(a.metric?.deviationPct ?? 0))
    .slice(0, 6);
}

/** Compact one-line description used by tables and the insight card. */
export function describeFinding(finding: Finding): string {
  if (finding.period) return finding.period.label;
  if (finding.kind === "concentration") return "Window";
  if (finding.kind === "backlog") return "Queue";
  return "—";
}
