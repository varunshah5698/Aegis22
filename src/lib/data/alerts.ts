import "server-only";

import type { RiskLevel } from "@/config/risk";
import { SAVED_VIEWS, type AlertQueueRow, type AlertStatus, type SavedViewId } from "@/lib/alerts/types";
import type { Database, Tables } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export { ALERT_STATUSES, SAVED_VIEWS } from "@/lib/alerts/types";
export type { AlertQueueRow, AlertStatus, SavedViewId } from "@/lib/alerts/types";

export async function listAlerts(
  supabase: Client,
  organizationId: string,
  options: { view: SavedViewId; userId: string; status?: string; severity?: string },
): Promise<AlertQueueRow[]> {
  const view = SAVED_VIEWS.find((item) => item.id === options.view) ?? SAVED_VIEWS[0];

  let query = supabase
    .from("alerts")
    .select(
      "id, title, severity, status, assignee_id, due_at, created_at, transaction_id, transactions!inner(external_id, amount, currency, amount_base, sender_country, receiver_country)",
    )
    .eq("organization_id", organizationId)
    .in("status", options.status ? ([options.status] as AlertStatus[]) : [...view.statuses])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(150);

  if (options.view === "mine") query = query.eq("assignee_id", options.userId);
  if (options.view === "unassigned") query = query.is("assignee_id", null);
  if (options.view === "critical") query = query.eq("severity", "critical");
  if (options.view === "breaching") query = query.lt("due_at", new Date().toISOString());
  if (options.severity) query = query.eq("severity", options.severity as RiskLevel);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const assigneeIds = [...new Set((data ?? []).map((row) => row.assignee_id).filter((id): id is string => Boolean(id)))];
  const assignees = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", assigneeIds);
    (profiles ?? []).forEach((profile) => assignees.set(profile.id, profile.full_name || profile.email));
  }

  return (data ?? []).map((row) => {
    const transaction = Array.isArray(row.transactions) ? row.transactions[0] : row.transactions;
    return {
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_id ? (assignees.get(row.assignee_id) ?? "Unknown") : null,
      dueAt: row.due_at,
      createdAt: row.created_at,
      transactionId: row.transaction_id,
      externalId: transaction?.external_id ?? "",
      amount: Number(transaction?.amount ?? 0),
      currency: transaction?.currency ?? "USD",
      amountBase: Number(transaction?.amount_base ?? 0),
      corridor: `${transaction?.sender_country ?? ""}-${transaction?.receiver_country ?? ""}`,
    };
  });
}

export interface AlertDetail {
  alert: Tables<"alerts">;
  transaction: Tables<"transactions"> | null;
  events: Array<Tables<"alert_events"> & { actorName: string | null }>;
  assigneeName: string | null;
  factors: Array<{ id: string; label: string; points: number; raw: number; triggered: boolean; narrative: string; facts: Record<string, unknown> }>;
  explanation: string;
  modelVersion: string;
  related: Array<{ id: string; externalId: string; createdAt: string; senderCountry: string; receiverCountry: string; amount: number; currency: string; riskScore: number }>;
}

export async function getAlertDetail(
  supabase: Client,
  organizationId: string,
  alertId: string,
): Promise<AlertDetail | null> {
  const { data: alert, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", alertId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!alert) return null;

  const [transactionResult, eventsResult] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", alert.transaction_id).maybeSingle(),
    supabase
      .from("alert_events")
      .select("*")
      .eq("alert_id", alert.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const transaction = transactionResult.data ?? null;
  const events = eventsResult.data ?? [];

  const actorIds = [...new Set([alert.assignee_id, ...events.map((event) => event.actor_id)].filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
    (profiles ?? []).forEach((profile) => names.set(profile.id, profile.full_name || profile.email));
  }

  const related = transaction
    ? await supabase
        .from("transactions")
        .select("id, external_id, created_at, sender_country, receiver_country, amount, currency, risk_score")
        .eq("organization_id", organizationId)
        .or(`sender_account_id.eq.${transaction.sender_account_id},receiver_account_id.eq.${transaction.sender_account_id}`)
        .neq("id", transaction.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const snapshot = (alert.score_snapshot ?? {}) as {
    contributions?: AlertDetail["factors"];
    summary?: string;
    modelVersion?: string;
  };

  return {
    alert,
    transaction,
    events: events.map((event) => ({
      ...event,
      actorName: event.actor_id ? (names.get(event.actor_id) ?? "Former member") : null,
    })),
    assigneeName: alert.assignee_id ? (names.get(alert.assignee_id) ?? "Former member") : null,
    factors: Array.isArray(snapshot.contributions) ? snapshot.contributions : [],
    explanation: snapshot.summary ?? alert.summary,
    modelVersion: snapshot.modelVersion ?? transaction?.model_version ?? "v1",
    related: (related.data ?? []).map((row) => ({
      id: row.id,
      externalId: row.external_id,
      createdAt: row.created_at,
      senderCountry: row.sender_country,
      receiverCountry: row.receiver_country,
      amount: Number(row.amount),
      currency: row.currency,
      riskScore: row.risk_score ?? 0,
    })),
  };
}

export async function getAssignableMembers(supabase: Client, organizationId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("organization_id", organizationId)
    .in("role", ["admin", "analyst"])
    .order("full_name");
  return data ?? [];
}
