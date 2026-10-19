import "server-only";

import { SCORE_BANDS, type RiskLevel } from "@/config/risk";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface TransactionFilters {
  risk: RiskLevel[];
  corridor: string;
  status: string;
  minAmount: number | null;
  maxAmount: number | null;
  query: string;
  sort: "created_at" | "amount" | "risk_score";
  direction: "asc" | "desc";
}

export function parseTransactionFilters(searchParams: Record<string, string | undefined>): TransactionFilters {
  const risk = (searchParams.risk ?? "")
    .split(",")
    .filter((value): value is RiskLevel => ["low", "medium", "high", "critical"].includes(value));
  const sort =
    searchParams.sort === "amount" || searchParams.sort === "risk_score" ? searchParams.sort : "created_at";
  return {
    risk,
    corridor: (searchParams.corridor ?? "").slice(0, 16),
    status: searchParams.status ?? "",
    minAmount: searchParams.min ? Number(searchParams.min) : null,
    maxAmount: searchParams.max ? Number(searchParams.max) : null,
    query: (searchParams.q ?? "").slice(0, 80),
    sort,
    direction: searchParams.dir === "asc" ? "asc" : "desc",
  };
}

export interface TransactionListRow {
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
  channel: string;
  purposeCode: string | null;
}

export async function listTransactions(
  supabase: Client,
  organizationId: string,
  filters: TransactionFilters,
  limit = 200,
): Promise<TransactionListRow[]> {
  let query = supabase
    .from("transactions")
    .select(
      "id, external_id, created_at, sender_name, receiver_name, sender_country, receiver_country, amount, currency, amount_base, risk_score, risk_level, status, channel, purpose_code",
    )
    .eq("organization_id", organizationId)
    .order(filters.sort, { ascending: filters.direction === "asc" })
    .limit(limit);

  if (filters.risk.length > 0) query = query.in("risk_level", filters.risk);
  if (filters.corridor) {
    const [sender, receiver] = filters.corridor.split("-");
    if (sender) query = query.eq("sender_country", sender);
    if (receiver) query = query.eq("receiver_country", receiver);
  }
  if (filters.status) query = query.eq("status", filters.status as "settled" | "pending" | "blocked" | "review");
  if (filters.minAmount !== null && Number.isFinite(filters.minAmount)) {
    query = query.gte("amount_base", filters.minAmount);
  }
  if (filters.maxAmount !== null && Number.isFinite(filters.maxAmount)) {
    query = query.lte("amount_base", filters.maxAmount);
  }
  if (filters.query) {
    const pattern = `%${filters.query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    query = query.or(`external_id.ilike.${pattern},sender_name.ilike.${pattern},receiver_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
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
    channel: row.channel,
    purposeCode: row.purpose_code,
  }));
}

export interface TransactionDetail extends TransactionListRow {
  scoreMs: number | null;
  modelVersion: string | null;
  scoredAt: string | null;
  riskFactors: Array<{
    id: string;
    label: string;
    points: number;
    raw: number;
    triggered: boolean;
    narrative: string;
    facts: Record<string, unknown>;
  }>;
  alerts: Array<{ id: string; title: string; severity: RiskLevel; status: string }>;
  related: TransactionListRow[];
}

export async function getTransactionDetail(
  supabase: Client,
  organizationId: string,
  id: string,
): Promise<TransactionDetail | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [alerts, related] = await Promise.all([
    supabase
      .from("alerts")
      .select("id, title, severity, status")
      .eq("organization_id", organizationId)
      .eq("transaction_id", id),
    supabase
      .from("transactions")
      .select("id, external_id, created_at, sender_name, receiver_name, sender_country, receiver_country, amount, currency, amount_base, risk_score, risk_level, status, channel, purpose_code")
      .eq("organization_id", organizationId)
      .or(`sender_account_id.eq.${data.sender_account_id},receiver_account_id.eq.${data.sender_account_id}`)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const factors = Array.isArray(data.risk_factors)
    ? (data.risk_factors as unknown as TransactionDetail["riskFactors"])
    : [];

  return {
    id: data.id,
    externalId: data.external_id,
    createdAt: data.created_at,
    senderName: data.sender_name,
    receiverName: data.receiver_name,
    senderCountry: data.sender_country,
    receiverCountry: data.receiver_country,
    amount: Number(data.amount),
    currency: data.currency,
    amountBase: Number(data.amount_base),
    riskScore: data.risk_score ?? 0,
    riskLevel: (data.risk_level ?? "low") as RiskLevel,
    status: data.status,
    channel: data.channel,
    purposeCode: data.purpose_code,
    scoreMs: data.score_ms,
    modelVersion: data.model_version,
    scoredAt: data.scored_at,
    riskFactors: factors.filter((factor) => factor && typeof factor.id === "string"),
    alerts: (alerts.data ?? []).map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
    })),
    related: (related.data ?? []).map((row) => ({
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
      channel: row.channel,
      purposeCode: row.purpose_code,
    })),
  };
}

export const riskFilterOptions: Array<{ value: RiskLevel; label: string; cutoff: number }> = [
  { value: "critical", label: "Critical", cutoff: SCORE_BANDS.critical },
  { value: "high", label: "High", cutoff: SCORE_BANDS.high },
  { value: "medium", label: "Medium", cutoff: SCORE_BANDS.medium },
  { value: "low", label: "Low", cutoff: 0 },
];
