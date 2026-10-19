"use server";

import { revalidatePath } from "next/cache";

import { requireOrganization } from "@/lib/auth";
import { REPORT_KINDS, type ReportKind } from "@/config/reports";
import { buildReport, toCsv, toPdf } from "@/lib/reports/build";
import type { Json } from "@/lib/supabase/database.types";

export interface ReportActionResult {
  ok: boolean;
  message: string;
  reportId?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export async function createReport(input: {
  kind: ReportKind;
  from: string;
  to: string;
  format: "csv" | "pdf";
}): Promise<ReportActionResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (profile.role === "viewer") return { ok: false, message: "Viewers cannot generate reports." };
  if (!REPORT_KINDS.includes(input.kind)) return { ok: false, message: "Unknown report type." };
  if (!DATE.test(input.from) || !DATE.test(input.to)) return { ok: false, message: "Pick a start and end date." };
  if (input.from > input.to) return { ok: false, message: "The start date must be before the end date." };
  if (daysBetween(input.from, input.to) > 366) return { ok: false, message: "Reports cover at most twelve months." };

  const { data: created, error } = await supabase
    .from("reports")
    .insert({
      organization_id: organization.id,
      kind: input.kind,
      date_from: input.from,
      date_to: input.to,
      format: input.format,
      status: "running",
      requested_by: user.id,
      params: { timezone: "UTC" } as Json,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, message: error?.message ?? "The report could not be queued." };

  try {
    const payload = await buildReport(supabase, { id: organization.id, name: organization.name }, input.kind, input.from, input.to);
    const bytes = input.format === "csv" ? new TextEncoder().encode(toCsv(payload)) : await toPdf(payload);
    const path = `${organization.id}/${created.id}.${input.format}`;
    const mime = input.format === "csv" ? "text/csv" : "application/pdf";

    const { error: uploadError } = await supabase.storage.from("reports").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("reports")
      .update({ status: "ready", storage_path: path, row_count: payload.rows.length, error: null })
      .eq("id", created.id)
      .eq("organization_id", organization.id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("audit_log").insert({
      organization_id: organization.id,
      actor_id: user.id,
      action: "report.generated",
      target_type: "report",
      target_id: created.id,
      metadata: { kind: input.kind, format: input.format, rows: payload.rows.length } as Json,
    });

    revalidatePath("/app/reports");
    return {
      ok: true,
      message: `${payload.rows.length.toLocaleString("en-US")} rows ready to download.`,
      reportId: created.id,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The report failed while rendering.";
    await supabase
      .from("reports")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", created.id)
      .eq("organization_id", organization.id);
    revalidatePath("/app/reports");
    return { ok: false, message: `Report failed: ${message}` };
  }
}

export async function getReportDownloadUrl(reportId: string): Promise<{ ok: boolean; url?: string; message: string }> {
  const { supabase, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };

  const { data: report } = await supabase
    .from("reports")
    .select("id, storage_path, status")
    .eq("id", reportId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!report || !report.storage_path) return { ok: false, message: "This report has no file yet." };
  if (report.status !== "ready") return { ok: false, message: "This report is not ready." };

  const { data, error } = await supabase.storage.from("reports").createSignedUrl(report.storage_path, 120);
  if (error || !data?.signedUrl) return { ok: false, message: error?.message ?? "Could not sign the download." };
  return { ok: true, url: data.signedUrl, message: "Download ready." };
}
