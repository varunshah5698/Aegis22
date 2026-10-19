"use server";

import { revalidatePath } from "next/cache";

import { requireOrganization } from "@/lib/auth";
import type { CasePriority, CaseStatus } from "@/lib/data/cases";
import type { Json } from "@/lib/supabase/database.types";

export interface CaseActionResult {
  ok: boolean;
  message: string;
  caseId?: string;
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
  actorId: string,
  action: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    target_type: "case",
    target_id: targetId,
    metadata: metadata as Json,
  });
}

export async function createCase(input: {
  title: string;
  summary?: string;
  priority?: CasePriority;
  alertId?: string;
}): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot create cases." };

  const title = input.title.trim();
  if (title.length < 3) return { ok: false, message: "Give the case a title of at least three characters." };
  if (title.length > 160) return { ok: false, message: "Keep the case title under 160 characters." };
  const priority = input.priority ?? "medium";

  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      organization_id: organization.id,
      title,
      summary: (input.summary ?? "").slice(0, 4000),
      priority,
      status: "open",
      owner_id: user.id,
      created_from_alert_id: input.alertId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, message: error?.message ?? "The case could not be created." };

  if (input.alertId) {
    const { data: alert } = await supabase
      .from("alerts")
      .select("id")
      .eq("id", input.alertId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (alert) {
      await supabase.from("case_alerts").insert({ case_id: created.id, alert_id: alert.id });
    }
  }

  await audit(supabase, organization.id, user.id, "case.created", created.id, { priority });
  revalidatePath("/app/cases");
  return { ok: true, message: "Case opened.", caseId: created.id };
}

export async function addCaseNote(caseId: string, body: string): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot add case notes." };

  const trimmed = body.trim();
  if (trimmed.length < 2) return { ok: false, message: "Write at least a couple of words." };
  if (trimmed.length > 10_000) return { ok: false, message: "Keep notes under 10,000 characters." };

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, status")
    .eq("id", caseId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!caseRow) return { ok: false, message: "Case not found." };
  if (caseRow.status === "closed") return { ok: false, message: "Reopen the case before adding notes." };

  const { error } = await supabase.from("case_notes").insert({ case_id: caseId, author_id: user.id, body: trimmed });
  if (error) return { ok: false, message: error.message };

  await supabase.from("cases").update({ updated_at: new Date().toISOString() }).eq("id", caseId);
  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath("/app/cases");
  return { ok: true, message: "Note added to the case file." };
}

export async function setCaseStatus(caseId: string, status: CaseStatus): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot change case status." };

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, status")
    .eq("id", caseId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!caseRow) return { ok: false, message: "Case not found." };
  if (caseRow.status === status) return { ok: true, message: "Status unchanged." };

  const { error } = await supabase
    .from("cases")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, `case.${status}`, caseId, { from: caseRow.status, to: status });
  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath("/app/cases");
  return { ok: true, message: "Case status updated." };
}

export async function setCasePriority(caseId: string, priority: CasePriority): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot change case priority." };

  const { error } = await supabase
    .from("cases")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, "case.priority_changed", caseId, { priority });
  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath("/app/cases");
  return { ok: true, message: "Priority updated." };
}

export async function assignCaseOwner(caseId: string, userId: string | null): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot assign cases." };

  const { error } = await supabase
    .from("cases")
    .update({ owner_id: userId, updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  if (userId && userId !== user.id) {
    const { data: caseRow } = await supabase.from("cases").select("title").eq("id", caseId).maybeSingle();
    await supabase.from("notifications").insert({
      organization_id: organization.id,
      user_id: userId,
      type: "case_assigned",
      title: "Case assigned to you",
      body: caseRow?.title ?? "",
      link: `/app/cases/${caseId}`,
    });
  }

  await audit(supabase, organization.id, user.id, "case.owner_changed", caseId, { owner_id: userId });
  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath("/app/cases");
  return { ok: true, message: userId ? "Case owner updated." : "Case unassigned." };
}

export async function linkAlertToCase(caseId: string, alertId: string): Promise<CaseActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot link alerts." };

  const [{ data: caseRow }, { data: alert }] = await Promise.all([
    supabase.from("cases").select("id").eq("id", caseId).eq("organization_id", organization.id).maybeSingle(),
    supabase.from("alerts").select("id").eq("id", alertId).eq("organization_id", organization.id).maybeSingle(),
  ]);
  if (!caseRow || !alert) return { ok: false, message: "Case or alert not found." };

  const { error } = await supabase.from("case_alerts").insert({ case_id: caseId, alert_id: alertId });
  if (error && !error.message.includes("duplicate")) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, "case.alert_linked", caseId, { alert_id: alertId });
  revalidatePath(`/app/cases/${caseId}`);
  return { ok: true, message: "Alert linked to the case." };
}
