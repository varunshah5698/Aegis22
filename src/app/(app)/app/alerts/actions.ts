"use server";

import { revalidatePath } from "next/cache";

import { requireOrganization } from "@/lib/auth";
import { canTransition, STATUS_LABELS } from "@/lib/alerts/transitions";
import type { AlertStatus } from "@/lib/data/alerts";
import type { Json } from "@/lib/supabase/database.types";

export interface ActionResult {
  ok: boolean;
  message: string;
  caseId?: string;
}

async function recordAudit(
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
    target_type: "alert",
    target_id: targetId,
    metadata: metadata as Json,
  });
}

export async function updateAlertStatus(
  alertId: string,
  nextStatus: AlertStatus,
  note?: string,
): Promise<ActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot change alert status." };

  const { data: alert, error } = await supabase
    .from("alerts")
    .select("id, status, organization_id")
    .eq("id", alertId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !alert) return { ok: false, message: "Alert not found." };
  if (!canTransition(alert.status, nextStatus)) {
    return {
      ok: false,
      message: `An alert cannot move from ${STATUS_LABELS[alert.status]} to ${STATUS_LABELS[nextStatus]}.`,
    };
  }

  const terminal = nextStatus === "resolved" || nextStatus === "false_positive";
  const { error: updateError } = await supabase
    .from("alerts")
    .update({
      status: nextStatus,
      resolved_at: terminal ? new Date().toISOString() : null,
      resolution_note: terminal ? (note ?? null) : null,
    })
    .eq("id", alertId)
    .eq("organization_id", organization.id);

  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    actor_id: user.id,
    event_type: terminal ? "status_changed" : nextStatus === "escalated" ? "escalated" : "status_changed",
    payload: { from: alert.status, to: nextStatus, note: note ?? null } as Json,
  });

  await recordAudit(supabase, organization.id, user.id, `alert.${nextStatus}`, alertId, {
    from: alert.status,
    to: nextStatus,
  });

  revalidatePath("/app/alerts");
  revalidatePath(`/app/alerts/${alertId}`);
  revalidatePath("/app/overview");
  return { ok: true, message: `Alert moved to ${STATUS_LABELS[nextStatus]}.` };
}

export async function assignAlert(alertId: string, userId: string | null): Promise<ActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot assign alerts." };

  const { data: alert } = await supabase
    .from("alerts")
    .select("id, title, status")
    .eq("id", alertId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!alert) return { ok: false, message: "Alert not found." };

  const { error } = await supabase
    .from("alerts")
    .update({ assignee_id: userId })
    .eq("id", alertId)
    .eq("organization_id", organization.id);

  if (error) return { ok: false, message: error.message };

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    actor_id: user.id,
    event_type: "assigned",
    payload: { assignee_id: userId } as Json,
  });

  if (userId && userId !== user.id) {
    await supabase.from("notifications").insert({
      organization_id: organization.id,
      user_id: userId,
      type: "alert_assigned",
      title: "Alert assigned to you",
      body: alert.title,
      link: `/app/alerts/${alertId}`,
    });
  }

  await recordAudit(supabase, organization.id, user.id, "alert.assigned", alertId, { assignee_id: userId });

  revalidatePath("/app/alerts");
  revalidatePath(`/app/alerts/${alertId}`);
  return { ok: true, message: userId ? "Alert assigned." : "Assignment cleared." };
}

export async function addAlertNote(alertId: string, body: string): Promise<ActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot add notes." };

  const trimmed = body.trim();
  if (trimmed.length < 2) return { ok: false, message: "Write at least a couple of words." };
  if (trimmed.length > 4000) return { ok: false, message: "Keep notes under 4,000 characters." };

  const { error } = await supabase.from("alert_events").insert({
    alert_id: alertId,
    actor_id: user.id,
    event_type: "note_added",
    payload: { note: trimmed } as Json,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/app/alerts/${alertId}`);
  return { ok: true, message: "Note added to the timeline." };
}

export async function bulkAlertAction(
  alertIds: string[],
  action: "assign_me" | "escalate" | "false_positive",
): Promise<ActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot change alerts." };
  if (alertIds.length === 0) return { ok: false, message: "Select at least one alert." };
  if (alertIds.length > 200) return { ok: false, message: "Bulk actions are limited to 200 alerts." };

  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, status")
    .eq("organization_id", organization.id)
    .in("id", alertIds);

  if (error) return { ok: false, message: error.message };

  let changed = 0;
  for (const alert of alerts ?? []) {
    if (action === "assign_me") {
      const { error: assignError } = await supabase
        .from("alerts")
        .update({ assignee_id: user.id })
        .eq("id", alert.id)
        .eq("organization_id", organization.id);
      if (!assignError) {
        await supabase.from("alert_events").insert({
          alert_id: alert.id,
          actor_id: user.id,
          event_type: "assigned",
          payload: { assignee_id: user.id, bulk: true } as Json,
        });
        changed += 1;
      }
      continue;
    }

    const target: AlertStatus = action === "escalate" ? "escalated" : "false_positive";
    if (!canTransition(alert.status, target)) continue;
    const terminal = target === "false_positive";
    const { error: updateError } = await supabase
      .from("alerts")
      .update({
        status: target,
        resolved_at: terminal ? new Date().toISOString() : null,
        resolution_note: terminal ? "Bulk false positive" : null,
      })
      .eq("id", alert.id)
      .eq("organization_id", organization.id);
    if (!updateError) {
      await supabase.from("alert_events").insert({
        alert_id: alert.id,
        actor_id: user.id,
        event_type: target === "escalated" ? "escalated" : "status_changed",
        payload: { from: alert.status, to: target, bulk: true } as Json,
      });
      changed += 1;
    }
  }

  await recordAudit(supabase, organization.id, user.id, `alert.bulk_${action}`, alertIds.join(","), {
    count: changed,
  });

  revalidatePath("/app/alerts");
  revalidatePath("/app/overview");
  return { ok: true, message: `${changed} of ${alertIds.length} alerts updated.` };
}

export async function createCaseFromAlert(alertId: string, title: string): Promise<ActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot create cases." };

  const cleanTitle = title.trim();
  if (cleanTitle.length < 3) return { ok: false, message: "Give the case a title of at least three characters." };

  const { data: alert } = await supabase
    .from("alerts")
    .select("id, title, summary")
    .eq("id", alertId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!alert) return { ok: false, message: "Alert not found." };

  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      organization_id: organization.id,
      title: cleanTitle.slice(0, 160),
      status: "open",
      priority: "high",
      owner_id: user.id,
      summary: alert.summary,
      created_from_alert_id: alert.id,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, message: error?.message ?? "Case could not be created." };

  await supabase.from("case_alerts").insert({ case_id: created.id, alert_id: alert.id });
  await recordAudit(supabase, organization.id, user.id, "case.created", created.id, { alert_id: alert.id });

  revalidatePath("/app/cases");
  revalidatePath(`/app/alerts/${alertId}`);
  return { ok: true, message: "Case created.", caseId: created.id };
}
