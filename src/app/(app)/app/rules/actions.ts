"use server";

import { revalidatePath } from "next/cache";

import { canPublishRules, requireOrganization } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

export interface RuleActionResult {
  ok: boolean;
  message: string;
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
  actorId: string,
  action: string,
  ruleId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    target_type: "rule",
    target_id: ruleId,
    metadata: metadata as Json,
  });
}

export async function publishRule(ruleId: string): Promise<RuleActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canPublishRules(profile.role)) return { ok: false, message: "Only administrators can publish rules." };

  const { data: rule } = await supabase
    .from("rules")
    .select("id, name, status")
    .eq("id", ruleId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!rule) return { ok: false, message: "Rule not found." };

  const { data: draft } = await supabase
    .from("rule_versions")
    .select("id, version, definition, change_note")
    .eq("rule_id", ruleId)
    .eq("is_draft", true)
    .maybeSingle();

  if (!draft) return { ok: false, message: "This rule has no draft version to publish." };

  const now = new Date().toISOString();
  const { error: versionError } = await supabase
    .from("rule_versions")
    .update({ is_draft: false, published_at: now, published_by: user.id })
    .eq("id", draft.id);
  if (versionError) return { ok: false, message: versionError.message };

  const { error: ruleError } = await supabase
    .from("rules")
    .update({ status: "active", current_version_id: draft.id, updated_at: now })
    .eq("id", ruleId)
    .eq("organization_id", organization.id);
  if (ruleError) return { ok: false, message: ruleError.message };

  const { data: hashRow } = await supabase
    .from("rule_versions")
    .select("definition_hash")
    .eq("id", draft.id)
    .maybeSingle();

  await supabase.from("rule_versions").insert({
    rule_id: ruleId,
    version: draft.version + 1,
    definition: draft.definition,
    definition_hash: hashRow?.definition_hash ?? "",
    is_draft: true,
    change_note: `Draft created automatically after publishing version ${draft.version}.`,
    created_by: user.id,
  });

  await audit(supabase, organization.id, user.id, "rule.published", ruleId, { version: draft.version });
  revalidatePath("/app/rules");
  return { ok: true, message: `${rule.name} version ${draft.version} is live.` };
}

export async function setRuleStatus(ruleId: string, status: "active" | "disabled"): Promise<RuleActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canPublishRules(profile.role)) return { ok: false, message: "Only administrators can change rule status." };

  const { data: rule } = await supabase
    .from("rules")
    .select("id, name, current_version_id")
    .eq("id", ruleId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!rule) return { ok: false, message: "Rule not found." };

  if (status === "active" && !rule.current_version_id) {
    return { ok: false, message: "Publish a draft version before turning this rule on." };
  }

  const { error } = await supabase
    .from("rules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, `rule.${status}`, ruleId);
  revalidatePath("/app/rules");
  revalidatePath("/app/overview");
  return {
    ok: true,
    message: status === "active" ? `${rule.name} is monitoring again.` : `${rule.name} is disabled.`,
  };
}
