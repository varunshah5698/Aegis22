import "server-only";

import { SCORE_BANDS, type RiskLevel } from "@/config/risk";
import { bucketSeries, rangeWindow, type RangeKey } from "@/lib/data/common";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface OverviewKpis {
  scannedToday: number;
  flaggedToday: number;
  openAlerts: number;
  averageScore: number;
  medianLatencyMs: number;
  scannedChange: number;
  flaggedChange: number;
}

const dayMs = 86_400_000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

export async function getOverviewKpis(supabase: Client, organizationId: string): Promise<OverviewKpis> {
  const now = new Date();
  const startToday = new Date(now.getTime() - dayMs);
  const startYesterday = new Date(now.getTime() - 2 * dayMs);

  const [scanned, flagged, previousScanned, previousFlagged, openAlerts, recent] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startToday.toISOString()),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startToday.toISOString())
      .gte("risk_score", SCORE_BANDS.alert),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startYesterday.toISOString())
      .lt("created_at", startToday.toISOString()),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startYesterday.toISOString())
      .lt("created_at", startToday.toISOString())
      .gte("risk_score", SCORE_BANDS.alert),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["new", "investigating", "escalated"]),
    supabase
      .from("transactions")
      .select("risk_score, score_ms")
      .eq("organization_id", organizationId)
      .gte("created_at", startToday.toISOString())
      .not("risk_score", "is", null)
      .limit(2000),
  ]);

  const rows = recent.data ?? [];
  const averageScore = rows.length
    ? rows.reduce((total, row) => total + (row.risk_score ?? 0), 0) / rows.length
    : 0;
  const medianLatency = median(rows.map((row) => row.score_ms ?? 0).filter((value) => value > 0));

  const scannedCount = scanned.count ?? 0;
  const flaggedCount = flagged.count ?? 0;
  const prevScanned = previousScanned.count ?? 0;
  const prevFlagged = previousFlagged.count ?? 0;

  return {
    scannedToday: scannedCount,
    flaggedToday: flaggedCount,
    openAlerts: openAlerts.count ?? 0,
    averageScore: Math.round(averageScore * 10) / 10,
    medianLatencyMs: medianLatency,
    scannedChange: prevScanned ? ((scannedCount - prevScanned) / prevScanned) * 100 : 0,
    flaggedChange: prevFlagged ? ((flaggedCount - prevFlagged) / prevFlagged) * 100 : 0,
  };
}

export interface VolumePoint {
  at: string;
  label: string;
  count: number;
  value: number;
}

export async function getVolumeSeries(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<VolumePoint[]> {
  const { from, to } = rangeWindow(range);
  const bucket = range === "24h" ? "hour" : "day";
  const { data, error } = await supabase
    .from("transactions")
    .select("created_at, amount_base")
    .eq("organization_id", organizationId)
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: true })
    .limit(20_000);

  if (error) throw new Error(error.message);

  return bucketSeries(
    data ?? [],
    (row) => new Date(row.created_at),
    from,
    to,
    bucket,
    (items) => ({
      count: items.length,
      value: Math.round(items.reduce((total, row) => total + Number(row.amount_base ?? 0), 0)),
    }),
  );
}

export async function getRiskDistribution(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<{ bins: Array<{ bin: string; low: number; high: number; count: number; level: RiskLevel }>; total: number }> {
  const { from } = rangeWindow(range);
  const { data, error } = await supabase
    .from("transactions")
    .select("risk_score")
    .eq("organization_id", organizationId)
    .gte("created_at", from.toISOString())
    .not("risk_score", "is", null)
    .limit(20_000);
  if (error) throw new Error(error.message);

  const bins = Array.from({ length: 10 }, (_, index) => {
    const low = index * 10;
    const high = low + 9;
    const level: RiskLevel = high < 40 ? "low" : high < 70 ? "medium" : high < 85 ? "high" : "critical";
    return { bin: `${low}-${high}`, low, high, count: 0, level };
  });

  for (const row of data ?? []) {
    const index = Math.min(9, Math.floor((row.risk_score ?? 0) / 10));
    const bin = bins[index];
    if (bin) bin.count += 1;
  }

  return { bins, total: data?.length ?? 0 };
}

export interface CorridorSummary {
  corridor: string;
  senderCountry: string;
  receiverCountry: string;
  count: number;
  value: number;
  flagged: number;
  averageScore: number;
}

export async function getCorridorSummaries(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<CorridorSummary[]> {
  const { from } = rangeWindow(range);
  const { data, error } = await supabase
    .from("transactions")
    .select("sender_country, receiver_country, amount_base, risk_score")
    .eq("organization_id", organizationId)
    .gte("created_at", from.toISOString())
    .limit(20_000);
  if (error) throw new Error(error.message);

  const map = new Map<string, CorridorSummary>();
  for (const row of data ?? []) {
    const key = `${row.sender_country}-${row.receiver_country}`;
    const entry =
      map.get(key) ??
      {
        corridor: key,
        senderCountry: row.sender_country,
        receiverCountry: row.receiver_country,
        count: 0,
        value: 0,
        flagged: 0,
        averageScore: 0,
      };
    entry.count += 1;
    entry.value += Number(row.amount_base ?? 0);
    if ((row.risk_score ?? 0) >= SCORE_BANDS.alert) entry.flagged += 1;
    entry.averageScore += row.risk_score ?? 0;
    map.set(key, entry);
  }

  return [...map.values()]
    .map((entry) => ({
      ...entry,
      value: Math.round(entry.value),
      averageScore: entry.count ? Math.round(entry.averageScore / entry.count) : 0,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

export interface FeedRow {
  id: string;
  externalId: string;
  createdAt: string;
  senderName: string;
  receiverName: string;
  senderCountry: string;
  receiverCountry: string;
  amount: number;
  currency: string;
  amountBase: number;
  riskScore: number;
  riskLevel: RiskLevel;
  status: string;
}

export async function getRecentTransactions(
  supabase: Client,
  organizationId: string,
  limit = 40,
): Promise<FeedRow[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, external_id, created_at, sender_name, receiver_name, sender_country, receiver_country, amount, currency, amount_base, risk_score, risk_level, status",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    externalId: row.external_id,
    createdAt: row.created_at,
    senderName: row.sender_name,
    receiverName: row.receiver_name,
    senderCountry: row.sender_country,
    receiverCountry: row.receiver_country,
    amount: Number(row.amount),
    currency: row.currency,
    amountBase: Number(row.amount_base),
    riskScore: row.risk_score ?? 0,
    riskLevel: (row.risk_level ?? "low") as RiskLevel,
    status: row.status,
  }));
}

export async function getAlertStatusCounts(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<Array<{ status: string; count: number }>> {
  const { from } = rangeWindow(range);
  const { data, error } = await supabase
    .from("alerts")
    .select("status")
    .eq("organization_id", organizationId)
    .gte("created_at", from.toISOString())
    .limit(5000);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return ["new", "investigating", "escalated", "resolved", "false_positive"].map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export interface MonthlyTotal {
  label: string;
  value: number;
  flaggedValue: number;
}

/**
 * Monthly screened and flagged value for the bar chart on the overview.
 *
 * Deliberately independent of the selected window: the chart answers "how has
 * the year been going", while the KPI tiles answer "how is the window going".
 */
export async function getMonthlyTotals(
  supabase: Client,
  organizationId: string,
  months = 8,
): Promise<MonthlyTotal[]> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const { data, error } = await supabase
    .from("transactions")
    .select("created_at, amount_base, risk_score")
    .eq("organization_id", organizationId)
    .gte("created_at", start.toISOString())
    .limit(20_000);
  if (error) throw new Error(error.message);

  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1) + index, 1));
    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      label: date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      value: 0,
      flaggedValue: 0,
    };
  });
  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index] as const));

  for (const row of data ?? []) {
    const created = new Date(row.created_at);
    const index = indexByKey.get(`${created.getUTCFullYear()}-${created.getUTCMonth()}`);
    const bucket = index === undefined ? undefined : buckets[index];
    if (!bucket) continue;
    const amount = Number(row.amount_base ?? 0);
    bucket.value += amount;
    if ((row.risk_score ?? 0) >= SCORE_BANDS.alert) bucket.flaggedValue += amount;
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: Math.round(bucket.value),
    flaggedValue: Math.round(bucket.flaggedValue),
  }));
}

export async function getOpenAlertSummary(supabase: Client, organizationId: string) {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, title, severity, status, due_at, created_at, transaction_id")
    .eq("organization_id", organizationId)
    .in("status", ["new", "investigating", "escalated"])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return data ?? [];
}
