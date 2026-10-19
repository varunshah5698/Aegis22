import "server-only";

import type { RuleDefinition } from "@/lib/schemas/rule";
import type { Database, Tables } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface RuleVersionRow {
  id: string;
  version: number;
  isDraft: boolean;
  changeNote: string;
  publishedAt: string | null;
  createdAt: string;
  publishedByName: string | null;
  definition: RuleDefinition;
}

export interface RuleRow {
  id: string;
  name: string;
  description: string;
  status: Tables<"rules">["status"];
  currentVersion: number | null;
  updatedAt: string;
  alertCount: number;
  versions: RuleVersionRow[];
}

export async function listRules(supabase: Client, organizationId: string): Promise<RuleRow[]> {
  const { data: rules, error } = await supabase
    .from("rules")
    .select("id, name, description, status, current_version_id, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!rules || rules.length === 0) return [];

  const ruleIds = rules.map((rule) => rule.id);
  const [{ data: versions }, { data: alerts }] = await Promise.all([
    supabase
      .from("rule_versions")
      .select("id, rule_id, version, definition, is_draft, published_at, published_by, change_note, created_at")
      .in("rule_id", ruleIds)
      .order("version", { ascending: false }),
    supabase.from("alerts").select("rule_id").eq("organization_id", organizationId).not("rule_id", "is", null).limit(10_000),
  ]);

  const publisherIds = [...new Set((versions ?? []).map((version) => version.published_by).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (publisherIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", publisherIds);
    (profiles ?? []).forEach((profile) => names.set(profile.id, profile.full_name || profile.email));
  }

  const alertCounts = new Map<string, number>();
  (alerts ?? []).forEach((alert) => {
    if (alert.rule_id) alertCounts.set(alert.rule_id, (alertCounts.get(alert.rule_id) ?? 0) + 1);
  });

  return rules.map((rule) => {
    const ruleVersions = (versions ?? []).filter((version) => version.rule_id === rule.id);
    const current = ruleVersions.find((version) => version.id === rule.current_version_id);
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      status: rule.status,
      currentVersion: current?.version ?? null,
      updatedAt: rule.updated_at,
      alertCount: alertCounts.get(rule.id) ?? 0,
      versions: ruleVersions.map((version) => ({
        id: version.id,
        version: version.version,
        isDraft: version.is_draft,
        changeNote: version.change_note,
        publishedAt: version.published_at,
        createdAt: version.created_at,
        publishedByName: version.published_by ? (names.get(version.published_by) ?? "Former member") : null,
        definition: version.definition as unknown as RuleDefinition,
      })),
    };
  });
}
