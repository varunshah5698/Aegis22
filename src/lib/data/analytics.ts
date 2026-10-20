import "server-only";

import { SCORE_BANDS, SIGNAL_LABELS, scoreToLevel, type RiskLevel, type SignalId } from "@/config/risk";
import { formatBucketLabel, rangeWindow, type RangeKey } from "@/lib/data/common";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** Row caps keep the per-request scans bounded on large demo datasets. */
const TX_CAP = 25_000;
const FACTOR_CAP = 5_000;
const ALERT_CAP = 5_000;
const CASE_CAP = 2_000;

export interface SeriesBucket {
  at: string;
  label: string;
  count: number;
  value: number;
  flagged: number;
  flaggedValue: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  lowValue: number;
  mediumValue: number;
  highValue: number;
  criticalValue: number;
  avgScore: number;
}

export interface CorridorStat {
  corridor: string;
  senderCountry: string;
  receiverCountry: string;
  count: number;
  value: number;
  flagged: number;
  flaggedValue: number;
  avgScore: number;
  peakScore: number;
  share: number;
  /** Payment count per bucket, used for the inline trend column. */
  spark: number[];
}

export interface SignalStat {
  id: SignalId;
  label: string;
  count: number;
  points: number;
  share: number;
}

export interface PeerStat {
  name: string;
  country: string;
  count: number;
  value: number;
  flagged: number;
  avgScore: number;
}

export interface AlertRollup {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  bySeverity: Array<{ severity: RiskLevel; count: number }>;
  open: number;
  breached: number;
  dueSoon: number;
  unassigned: number;
  medianResolutionHours: number | null;
}

export interface CaseRollup {
  total: number;
  open: number;
  inReview: number;
  closed: number;
  openedInRange: number;
}

export interface WorkspaceAnalytics {
  range: RangeKey;
  bucket: "hour" | "day";
  window: { from: string; to: string; days: number };
  totals: {
    count: number;
    value: number;
    flagged: number;
    flaggedValue: number;
    flaggedShare: number;
    avgScore: number;
    medianScore: number;
    scoreP90: number;
    latencyP50: number;
    latencyP95: number;
    corridors: number;
    counterparties: number;
  };
  previous: {
    count: number;
    value: number;
    flagged: number;
  };
  /**
   * The four windows before the selected one, plus their median. This is what
   * lets the analyst talk about trajectory instead of one isolated snapshot.
   */
  history: {
    windows: Array<{ label: string; from: string; to: string; count: number; value: number; flagged: number }>;
    baseline: { count: number; value: number; flagged: number; windows: number };
  };
  deltas: {
    count: number | null;
    value: number | null;
    flagged: number | null;
  };
  series: SeriesBucket[];
  distribution: Array<{ bin: string; low: number; high: number; count: number; level: RiskLevel; share: number }>;
  riskMix: Array<{ level: RiskLevel; count: number; value: number; share: number }>;
  corridors: CorridorStat[];
  matrix: {
    bucketLabels: string[];
    rows: Array<{ corridor: string; senderCountry: string; receiverCountry: string; cells: Array<number | null>; value: number }>;
  };
  board: {
    /** 7 (weekday) × 24 (hour) payment counts, UTC. */
    counts: number[][];
    peak: { weekday: number; hour: number; count: number } | null;
  };
  latency: Array<{ bucket: string; count: number }>;
  signals: SignalStat[];
  peers: PeerStat[];
  currencies: Array<{ currency: string; count: number; value: number }>;
  alerts: AlertRollup;
  cases: CaseRollup;
}

function bucketLayout(from: Date, to: Date, bucket: "hour" | "day") {
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  const start = new Date(from);
  if (bucket === "day") start.setUTCHours(0, 0, 0, 0);
  else start.setUTCMinutes(0, 0, 0);
  const startMs = start.getTime();
  const total = Math.max(1, Math.floor((to.getTime() - startMs) / stepMs) + 1);
  return { stepMs, startMs, total };
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function median(values: number[]): number {
  return Math.round(quantile(values, 0.5));
}

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * One pass over the selected window produces every aggregate the dashboard
 * pages need: bucketed series, corridor stats, weekday/hour board, score and
 * latency distributions plus the alert and case rollups.
 */
export async function getWorkspaceAnalytics(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<WorkspaceAnalytics> {
  const { from, to, days } = rangeWindow(range);
  const bucket = range === "24h" ? "hour" : "day";
  const { stepMs, startMs, total } = bucketLayout(from, to, bucket);

  // One query per preceding window. A single range capped by the host's row
  // limit would silently drop the older windows, which is exactly the history
  // the analyst needs.
  const windowBounds = Array.from({ length: 4 }, (_, index) => {
    const end = new Date(from.getTime() - index * days * 86_400_000);
    return { start: new Date(end.getTime() - days * 86_400_000), end };
  });

  const historyQuery = ({ start, end }: { start: Date; end: Date }) =>
    supabase
      .from("transactions")
      .select("created_at, amount_base, risk_score")
      .eq("organization_id", organizationId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .limit(TX_CAP);

  const [txResult, history0, history1, history2, history3, factorResult, alertResult, caseResult] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("created_at, amount_base, currency, risk_score, risk_level, sender_country, receiver_country, sender_name, score_ms")
        .eq("organization_id", organizationId)
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: true })
        .limit(TX_CAP),
      historyQuery(windowBounds[0]!),
      historyQuery(windowBounds[1]!),
      historyQuery(windowBounds[2]!),
      historyQuery(windowBounds[3]!),
      supabase
      .from("transactions")
      .select("risk_factors")
      .eq("organization_id", organizationId)
      .gte("created_at", from.toISOString())
      .gte("risk_score", SCORE_BANDS.alert)
      .limit(FACTOR_CAP),
    supabase
      .from("alerts")
      .select("severity, status, due_at, created_at, resolved_at, assignee_id")
      .eq("organization_id", organizationId)
      .gte("created_at", from.toISOString())
      .limit(ALERT_CAP),
    supabase
      .from("cases")
      .select("status, created_at")
      .eq("organization_id", organizationId)
      .limit(CASE_CAP),
  ]);

  const historyResults = [history0, history1, history2, history3];
  for (const result of [txResult, ...historyResults, factorResult, alertResult, caseResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const rows = txResult.data ?? [];

  /* ---------------------------------------------------------------- series */

  const series: SeriesBucket[] = Array.from({ length: total }, (_, index) => {
    const at = new Date(startMs + index * stepMs);
    return {
      at: at.toISOString(),
      label: formatBucketLabel(at, bucket),
      count: 0,
      value: 0,
      flagged: 0,
      flaggedValue: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      lowValue: 0,
      mediumValue: 0,
      highValue: 0,
      criticalValue: 0,
      avgScore: 0,
    };
  });

  /* ------------------------------------------------------------ aggregates */

  const corridorMap = new Map<string, CorridorStat & { scoreSum: number; sparkScore: number[] }>();
  const signalMap = new Map<SignalId, { count: number; points: number }>();
  const peerMap = new Map<string, PeerStat & { scoreSum: number }>();
  const currencyMap = new Map<string, { count: number; value: number }>();
  const boardCounts: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const latencyBuckets = new Map<number, number>();

  let totalValue = 0;
  let flagged = 0;
  let flaggedValue = 0;
  let scoreSum = 0;
  let scored = 0;
  const scores: number[] = [];
  const latencies: number[] = [];
  const levelCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const levelValues: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const index = Math.floor((createdAt.getTime() - startMs) / stepMs);
    const value = Number(row.amount_base ?? 0);
    const score = row.risk_score ?? 0;
    const level = (row.risk_level ?? scoreToLevel(score)) as RiskLevel;
    const isFlagged = score >= SCORE_BANDS.alert;
    const inBucket = index >= 0 && index < series.length;

    const point = inBucket ? series[index]! : null;
    if (point) {
      point.count += 1;
      point.value += value;
      point[level] += 1;
      point[`${level}Value`] += value;
      point.avgScore += score;
      if (isFlagged) {
        point.flagged += 1;
        point.flaggedValue += value;
      }
    }

    totalValue += value;
    if (isFlagged) {
      flagged += 1;
      flaggedValue += value;
    }
    if (typeof row.risk_score === "number") {
      scores.push(score);
      scoreSum += score;
      scored += 1;
    }
    levelCounts[level] += 1;
    levelValues[level] += value;

    const corridor = `${row.sender_country}-${row.receiver_country}`;
    const corridorEntry =
      corridorMap.get(corridor) ??
      {
        corridor,
        senderCountry: row.sender_country,
        receiverCountry: row.receiver_country,
        count: 0,
        value: 0,
        flagged: 0,
        flaggedValue: 0,
        avgScore: 0,
        peakScore: 0,
        share: 0,
        spark: Array.from({ length: total }, () => 0),
        scoreSum: 0,
        sparkScore: Array.from({ length: total }, () => 0),
      };
    corridorEntry.count += 1;
    corridorEntry.value += value;
    corridorEntry.scoreSum += score;
    corridorEntry.peakScore = Math.max(corridorEntry.peakScore, score);
    if (isFlagged) {
      corridorEntry.flagged += 1;
      corridorEntry.flaggedValue += value;
    }
    if (inBucket) {
      corridorEntry.spark[index] = (corridorEntry.spark[index] ?? 0) + 1;
      corridorEntry.sparkScore[index] = (corridorEntry.sparkScore[index] ?? 0) + score;
    }
    corridorMap.set(corridor, corridorEntry);

    const peerName = row.sender_name || "Unknown payer";
    const peer =
      peerMap.get(peerName) ??
      { name: peerName, country: row.sender_country, count: 0, value: 0, flagged: 0, avgScore: 0, scoreSum: 0 };
    peer.count += 1;
    peer.value += value;
    peer.scoreSum += score;
    if (isFlagged) peer.flagged += 1;
    peerMap.set(peerName, peer);

    const currency = currencyMap.get(row.currency) ?? { count: 0, value: 0 };
    currency.count += 1;
    currency.value += value;
    currencyMap.set(row.currency, currency);

    const weekday = createdAt.getUTCDay();
    const hour = createdAt.getUTCHours();
    const weekdayRow = boardCounts[weekday]!;
    weekdayRow[hour] = (weekdayRow[hour] ?? 0) + 1;

    if (typeof row.score_ms === "number" && row.score_ms > 0) {
      latencies.push(row.score_ms);
      const lower = Math.floor(row.score_ms / 20) * 20;
      latencyBuckets.set(lower, (latencyBuckets.get(lower) ?? 0) + 1);
    }
  }

  for (const point of series) {
    point.avgScore = point.count > 0 ? Math.round((point.avgScore / point.count) * 10) / 10 : 0;
    point.value = Math.round(point.value);
  }

  const corridors: CorridorStat[] = [...corridorMap.values()]
    .map((entry) => ({
      corridor: entry.corridor,
      senderCountry: entry.senderCountry,
      receiverCountry: entry.receiverCountry,
      count: entry.count,
      value: Math.round(entry.value),
      flagged: entry.flagged,
      flaggedValue: Math.round(entry.flaggedValue),
      avgScore: entry.count > 0 ? Math.round(entry.scoreSum / entry.count) : 0,
      peakScore: Math.round(entry.peakScore),
      share: pct(entry.value, totalValue),
      spark: entry.spark,
    }))
    .sort((a, b) => b.value - a.value);

  /* ------------------------------------------------------------- distribution */

  const bins = Array.from({ length: 10 }, (_, index) => {
    const low = index * 10;
    const high = low + 9;
    const level: RiskLevel = high < 40 ? "low" : high < 70 ? "medium" : high < 85 ? "high" : "critical";
    return { bin: `${low}-${high}`, low, high, count: 0, level, share: 0 };
  });
  for (const score of scores) {
    const bin = bins[Math.min(9, Math.floor(score / 10))];
    if (bin) bin.count += 1;
  }
  for (const bin of bins) bin.share = pct(bin.count, scores.length);

  /* ------------------------------------------------------------------ signals */

  const factorRows = (factorResult.data ?? []) as Array<{ risk_factors: unknown }>;
  for (const row of factorRows) {
    const factors = Array.isArray(row.risk_factors) ? (row.risk_factors as Array<Record<string, unknown>>) : [];
    for (const factor of factors) {
      if (!factor || factor.triggered !== true) continue;
      const id = String(factor.id ?? "") as SignalId;
      if (!(id in SIGNAL_LABELS)) continue;
      const entry = signalMap.get(id) ?? { count: 0, points: 0 };
      entry.count += 1;
      entry.points += Number(factor.points ?? 0);
      signalMap.set(id, entry);
    }
  }
  const signalTotal = [...signalMap.values()].reduce((sum, entry) => sum + entry.count, 0);
  const signals: SignalStat[] = [...signalMap.entries()]
    .map(([id, entry]) => ({
      id,
      label: SIGNAL_LABELS[id],
      count: entry.count,
      points: Math.round(entry.points),
      share: pct(entry.count, signalTotal),
    }))
    .sort((a, b) => b.count - a.count);

  /* -------------------------------------------------------------------- peers */

  const peers: PeerStat[] = [...peerMap.values()]
    .map((entry) => ({
      name: entry.name,
      country: entry.country,
      count: entry.count,
      value: Math.round(entry.value),
      flagged: entry.flagged,
      avgScore: entry.count > 0 ? Math.round(entry.scoreSum / entry.count) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  /* ------------------------------------------------------------------- matrix */

  const matrixCorridors = corridors.slice(0, 8);
  const matrix: WorkspaceAnalytics["matrix"] = {
    bucketLabels: series.map((point) => point.label),
    rows: matrixCorridors.map((entry) => {
      const source = corridorMap.get(entry.corridor);
      const counts = source?.spark ?? [];
      const sums = source?.sparkScore ?? [];
      return {
        corridor: entry.corridor,
        senderCountry: entry.senderCountry,
        receiverCountry: entry.receiverCountry,
        cells: counts.map((count, index) => (count > 0 ? Math.round((sums[index] ?? 0) / count) : null)),
        value: entry.value,
      };
    }),
  };

  /* ------------------------------------------------------------------- board */

  let peak: { weekday: number; hour: number; count: number } | null = null;
  boardCounts.forEach((hours, weekday) => {
    hours.forEach((count, hour) => {
      if (!peak || count > peak.count) peak = { weekday, hour, count };
    });
  });

  /* ----------------------------------------------------------------- latency */

  const latency = [...latencyBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lower, count]) => ({ bucket: `${lower}–${lower + 19}`, count }));

  /* ------------------------------------------------------------------ alerts */

  const alertRows = alertResult.data ?? [];
  const now = Date.now();
  const statusCounts = new Map<string, number>();
  const severityCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let open = 0;
  let breached = 0;
  let dueSoon = 0;
  let unassigned = 0;
  const resolutionHours: number[] = [];

  for (const row of alertRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    severityCounts[(row.severity ?? "medium") as RiskLevel] += 1;
    const isOpen = row.status === "new" || row.status === "investigating" || row.status === "escalated";
    if (isOpen) {
      open += 1;
      if (!row.assignee_id) unassigned += 1;
      if (row.due_at) {
        const due = new Date(row.due_at).getTime();
        if (due < now) breached += 1;
        else if (due - now < 6 * 3_600_000) dueSoon += 1;
      }
    }
    if (row.resolved_at) {
      resolutionHours.push((new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000);
    }
  }

  const statusOrder = ["new", "investigating", "escalated", "resolved", "false_positive"];
  const alerts: AlertRollup = {
    total: alertRows.length,
    byStatus: statusOrder.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    bySeverity: (["critical", "high", "medium", "low"] as RiskLevel[]).map((severity) => ({
      severity,
      count: severityCounts[severity],
    })),
    open,
    breached,
    dueSoon,
    unassigned,
    medianResolutionHours: resolutionHours.length > 0 ? Math.round(quantile(resolutionHours, 0.5) * 10) / 10 : null,
  };

  /* ------------------------------------------------------------------- cases */

  const caseRows = caseResult.data ?? [];
  const cases: CaseRollup = {
    total: caseRows.length,
    open: caseRows.filter((row) => row.status === "open").length,
    inReview: caseRows.filter((row) => row.status === "in_review").length,
    closed: caseRows.filter((row) => row.status === "closed").length,
    openedInRange: caseRows.filter((row) => new Date(row.created_at).getTime() >= from.getTime()).length,
  };

  /* ---------------------------------------------------- previous and history */

  const historyWindows = historyResults.map((result, index) => {
    const bounds = windowBounds[index]!;
    let value = 0;
    let flagged = 0;
    for (const row of result.data ?? []) {
      value += Number(row.amount_base ?? 0);
      if ((row.risk_score ?? 0) >= SCORE_BANDS.alert) flagged += 1;
    }
    return {
      label: `${bounds.start.toISOString().slice(0, 10)} → ${bounds.end.toISOString().slice(0, 10)}`,
      from: bounds.start.toISOString(),
      to: bounds.end.toISOString(),
      count: (result.data ?? []).length,
      value: Math.round(value),
      flagged,
    };
  });

  const windowsWithData = historyWindows.filter((window) => window.count > 0);
  const previousValue = historyWindows[0]?.value ?? 0;
  const previousFlagged = historyWindows[0]?.flagged ?? 0;
  const previousCount = historyWindows[0]?.count ?? 0;
  const historyBaseline = {
    count: windowsWithData.length ? median(windowsWithData.map((window) => window.count)) : 0,
    value: windowsWithData.length ? median(windowsWithData.map((window) => window.value)) : 0,
    flagged: windowsWithData.length ? median(windowsWithData.map((window) => window.flagged)) : 0,
    windows: windowsWithData.length,
  };

  const change = (current: number, previous: number): number | null =>
    previous > 0 ? ((current - previous) / previous) * 100 : null;

  const currencies = [...currencyMap.entries()]
    .map(([currency, entry]) => ({ currency, count: entry.count, value: Math.round(entry.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return {
    range,
    bucket,
    window: { from: from.toISOString(), to: to.toISOString(), days },
    totals: {
      count: rows.length,
      value: Math.round(totalValue),
      flagged,
      flaggedValue: Math.round(flaggedValue),
      flaggedShare: pct(flagged, rows.length),
      avgScore: scored > 0 ? Math.round((scoreSum / scored) * 10) / 10 : 0,
      medianScore: median(scores),
      scoreP90: Math.round(quantile(scores, 0.9)),
      latencyP50: Math.round(quantile(latencies, 0.5)),
      latencyP95: Math.round(quantile(latencies, 0.95)),
      corridors: corridorMap.size,
      counterparties: peerMap.size,
    },
    previous: {
      count: previousCount,
      value: Math.round(previousValue),
      flagged: previousFlagged,
    },
    history: {
      windows: historyWindows,
      baseline: historyBaseline,
    },
    deltas: {
      count: change(rows.length, previousCount),
      value: change(totalValue, previousValue),
      flagged: change(flagged, previousFlagged),
    },
    series,
    distribution: bins,
    riskMix: (["low", "medium", "high", "critical"] as RiskLevel[]).map((level) => ({
      level,
      count: levelCounts[level],
      value: Math.round(levelValues[level]),
      share: pct(levelCounts[level], rows.length),
    })),
    corridors,
    matrix,
    board: { counts: boardCounts, peak },
    latency,
    signals,
    peers,
    currencies,
    alerts,
    cases,
  };
}
