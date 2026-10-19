import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "analyst" | "viewer";
  timezone: string;
  joinedAt: string;
}

export async function getTeamMembers(supabase: Client, organizationId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, timezone, created_at")
    .eq("organization_id", organizationId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((member) => ({
    id: member.id,
    email: member.email,
    fullName: member.full_name,
    role: member.role,
    timezone: member.timezone,
    joinedAt: member.created_at,
  }));
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdBy: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function getApiKeys(supabase: Client, organizationId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, prefix, scopes, created_by, last_used_at, revoked_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    createdBy: key.created_by,
    lastUsedAt: key.last_used_at,
    revokedAt: key.revoked_at,
    createdAt: key.created_at,
  }));
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
}

export async function getAuditEntries(
  supabase: Client,
  organizationId: string,
  options: { action?: string | undefined; actorId?: string | undefined; limit?: number } = {},
): Promise<AuditEntry[]> {
  let query = supabase
    .from("audit_log")
    .select("id, action, target_type, target_id, metadata, created_at, actor_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.action) query = query.ilike("action", `${options.action}%`);
  if (options.actorId) query = query.eq("actor_id", options.actorId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
    (profiles ?? []).forEach((profile) => names.set(profile.id, profile.full_name || profile.email));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    actorName: row.actor_id ? (names.get(row.actor_id) ?? "Former member") : "System",
  }));
}

export async function getAuditActions(supabase: Client, organizationId: string): Promise<string[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("action")
    .eq("organization_id", organizationId)
    .order("action", { ascending: true })
    .limit(1000);
  return [...new Set((data ?? []).map((row) => row.action))].sort();
}
