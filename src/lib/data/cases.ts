import "server-only";

import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  type CasePriority,
  type CaseRow,
  type CaseStatus,
} from "@/lib/cases/types";
import type { Database, Tables } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
} from "@/lib/cases/types";
export type { CasePriority, CaseRow, CaseStatus } from "@/lib/cases/types";

async function memberNames(supabase: Client, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  (data ?? []).forEach((profile) => names.set(profile.id, profile.full_name || profile.email));
  return names;
}

export async function listCases(
  supabase: Client,
  organizationId: string,
  options: { status?: string | undefined; priority?: string | undefined; q?: string | undefined } = {},
): Promise<CaseRow[]> {
  let query = supabase
    .from("cases")
    .select("id, title, summary, status, priority, owner_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (options.status && CASE_STATUSES.includes(options.status as CaseStatus)) {
    query = query.eq("status", options.status as CaseStatus);
  }
  if (options.priority && CASE_PRIORITIES.includes(options.priority as CasePriority)) {
    query = query.eq("priority", options.priority as CasePriority);
  }
  if (options.q) {
    const safe = options.q.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [{ data: alertLinks }, { data: noteRows }, names] = await Promise.all([
    supabase.from("case_alerts").select("case_id").in("case_id", ids),
    supabase.from("case_notes").select("case_id").in("case_id", ids),
    memberNames(supabase, rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id))),
  ]);

  const alertCounts = new Map<string, number>();
  (alertLinks ?? []).forEach((link) => alertCounts.set(link.case_id, (alertCounts.get(link.case_id) ?? 0) + 1));
  const noteCounts = new Map<string, number>();
  (noteRows ?? []).forEach((note) => noteCounts.set(note.case_id, (noteCounts.get(note.case_id) ?? 0) + 1));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    ownerId: row.owner_id,
    ownerName: row.owner_id ? (names.get(row.owner_id) ?? "Former member") : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alertCount: alertCounts.get(row.id) ?? 0,
    noteCount: noteCounts.get(row.id) ?? 0,
  }));
}

export interface CaseAlertLink {
  alertId: string;
  title: string;
  severity: Tables<"alerts">["severity"];
  status: Tables<"alerts">["status"];
  transactionId: string;
  externalId: string;
  amount: number;
  currency: string;
  amountBase: number;
  corridor: string;
  createdAt: string;
}

export interface CaseNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface CaseDetail {
  case: Tables<"cases">;
  ownerName: string | null;
  alerts: CaseAlertLink[];
  notes: CaseNote[];
  entities: Array<{ id: string; legalName: string; kind: string; country: string; pepFlag: boolean }>;
}

export async function getCaseDetail(
  supabase: Client,
  organizationId: string,
  caseId: string,
): Promise<CaseDetail | null> {
  const { data: caseRow, error } = await supabase
    .from("cases")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", caseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!caseRow) return null;

  const [{ data: links }, { data: noteRows }, { data: entityLinks }] = await Promise.all([
    supabase.from("case_alerts").select("alert_id").eq("case_id", caseId),
    supabase.from("case_notes").select("id, body, author_id, created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("case_entities").select("entity_id").eq("case_id", caseId),
  ]);

  const alertIds = (links ?? []).map((link) => link.alert_id);
  const entityIds = (entityLinks ?? []).map((link) => link.entity_id);

  const [{ data: alerts }, { data: entities }, names] = await Promise.all([
    alertIds.length > 0
      ? supabase
          .from("alerts")
          .select(
            "id, title, severity, status, created_at, transaction_id, transactions!inner(external_id, amount, currency, amount_base, sender_country, receiver_country)",
          )
          .in("id", alertIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    entityIds.length > 0
      ? supabase
          .from("entities")
          .select("id, legal_name, kind, country, pep_flag")
          .in("id", entityIds)
      : Promise.resolve({ data: [] as never[] }),
    memberNames(
      supabase,
      [caseRow.owner_id, ...(noteRows ?? []).map((note) => note.author_id)].filter((id): id is string => Boolean(id)),
    ),
  ]);

  return {
    case: caseRow,
    ownerName: caseRow.owner_id ? (names.get(caseRow.owner_id) ?? "Former member") : null,
    alerts: (alerts ?? []).map((alert) => {
      const transaction = Array.isArray(alert.transactions) ? alert.transactions[0] : alert.transactions;
      return {
        alertId: alert.id,
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        transactionId: alert.transaction_id,
        externalId: transaction?.external_id ?? "",
        amount: Number(transaction?.amount ?? 0),
        currency: transaction?.currency ?? "USD",
        amountBase: Number(transaction?.amount_base ?? 0),
        corridor: `${transaction?.sender_country ?? ""}-${transaction?.receiver_country ?? ""}`,
        createdAt: alert.created_at,
      };
    }),
    notes: (noteRows ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.author_id ? (names.get(note.author_id) ?? "Former member") : "System",
      createdAt: note.created_at,
    })),
    entities: (entities ?? []).map((entity) => ({
      id: entity.id,
      legalName: entity.legal_name,
      kind: entity.kind,
      country: entity.country,
      pepFlag: entity.pep_flag,
    })),
  };
}

export async function getAssignableCaseOwners(supabase: Client, organizationId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .in("role", ["admin", "analyst"])
    .order("full_name");
  return data ?? [];
}
