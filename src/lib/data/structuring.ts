import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** Reference threshold for cash-reporting style obligations, in USD. */
export const REPORTING_THRESHOLD = 10_000;
const BAND_FLOOR = 8_000;
const WINDOW_HOURS = 48;
const MIN_TRANSFERS = 4;
const MIN_WINDOW_SUM = 25_000;

export interface StructuringTransfer {
  id: string;
  externalId: string;
  amount: number;
  createdAt: string;
  senderName: string;
  senderAccountId: string;
  senderCountry: string;
  riskScore: number;
}

export interface StructuringCluster {
  receiverAccountId: string;
  receiverName: string;
  receiverCountry: string;
  corridor: string;
  windowStart: string;
  windowEnd: string;
  transfers: StructuringTransfer[];
  total: number;
  averageTicket: number;
  largestTransfer: number;
  senderCount: number;
  averageScore: number;
  excessOverThreshold: number;
}

export interface StructuringReport {
  clusters: StructuringCluster[];
  stats: {
    clusters: number;
    totalValue: number;
    accounts: number;
    largestWindow: number;
    windowHours: number;
  };
}

interface RawTransfer {
  id: string;
  external_id: string;
  amount_base: number;
  created_at: string;
  sender_name: string;
  sender_account_id: string;
  receiver_account_id: string;
  receiver_name: string;
  sender_country: string;
  receiver_country: string;
  risk_score: number | null;
}

export async function getStructuringClusters(
  supabase: Client,
  organizationId: string,
  days = 90,
): Promise<StructuringReport> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, external_id, amount_base, created_at, sender_name, sender_account_id, receiver_account_id, receiver_name, sender_country, receiver_country, risk_score",
    )
    .eq("organization_id", organizationId)
    .gte("created_at", from)
    .gte("amount_base", BAND_FLOOR)
    .lt("amount_base", REPORTING_THRESHOLD)
    .order("created_at", { ascending: true })
    .limit(20_000);

  if (error) throw new Error(error.message);

  const byReceiver = new Map<string, RawTransfer[]>();
  for (const row of data ?? []) {
    const list = byReceiver.get(row.receiver_account_id) ?? [];
    list.push(row as RawTransfer);
    byReceiver.set(row.receiver_account_id, list);
  }

  const windowMs = WINDOW_HOURS * 3_600_000;
  const clusters: StructuringCluster[] = [];

  for (const [receiverAccountId, rows] of byReceiver) {
    if (rows.length < MIN_TRANSFERS) continue;
    const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let best: RawTransfer[] = [];
    let bestTotal = 0;
    let start = 0;

    for (let end = 0; end < sorted.length; end += 1) {
      const endTime = new Date(sorted[end]!.created_at).getTime();
      while (start < end && endTime - new Date(sorted[start]!.created_at).getTime() > windowMs) start += 1;

      const window = sorted.slice(start, end + 1);
      if (window.length < MIN_TRANSFERS) continue;
      const senders = new Set(window.map((row) => row.sender_account_id));
      if (senders.size < 2) continue;
      const total = window.reduce((sum, row) => sum + Number(row.amount_base), 0);
      if (total < MIN_WINDOW_SUM) continue;
      if (total > bestTotal) {
        best = window;
        bestTotal = total;
      }
    }

    if (best.length === 0) continue;

    const averageScore = Math.round(best.reduce((sum, row) => sum + (row.risk_score ?? 0), 0) / best.length);
    const first = best[0]!;
    const last = best[best.length - 1]!;

    clusters.push({
      receiverAccountId,
      receiverName: first.receiver_name,
      receiverCountry: first.receiver_country,
      corridor: `${first.sender_country}-${first.receiver_country}`,
      windowStart: first.created_at,
      windowEnd: last.created_at,
      transfers: best.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        amount: Number(row.amount_base),
        createdAt: row.created_at,
        senderName: row.sender_name,
        senderAccountId: row.sender_account_id,
        senderCountry: row.sender_country,
        riskScore: row.risk_score ?? 0,
      })),
      total: Math.round(bestTotal),
      averageTicket: Math.round(bestTotal / best.length),
      largestTransfer: Math.round(Math.max(...best.map((row) => Number(row.amount_base)))),
      senderCount: new Set(best.map((row) => row.sender_account_id)).size,
      averageScore,
      excessOverThreshold: Math.round(bestTotal - REPORTING_THRESHOLD),
    });
  }

  clusters.sort((a, b) => b.total - a.total);
  const top = clusters.slice(0, 40);

  return {
    clusters: top,
    stats: {
      clusters: top.length,
      totalValue: top.reduce((sum, cluster) => sum + cluster.total, 0),
      accounts: new Set(top.flatMap((cluster) => cluster.transfers.map((transfer) => transfer.senderAccountId))).size,
      largestWindow: top[0]?.total ?? 0,
      windowHours: WINDOW_HOURS,
    },
  };
}
