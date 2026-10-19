import type { Metadata } from "next";

import { PageShell } from "@/components/app/page-shell";
import { ReportsPanel, type ReportListRow } from "@/components/dashboard/reports-panel";
import { requireOrganization } from "@/lib/auth";
import { REPORT_KINDS, type ReportKind } from "@/config/reports";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase, profile, organization } = await requireOrganization();

  const { data, error } = await supabase
    .from("reports")
    .select("id, kind, date_from, date_to, status, format, row_count, error, created_at, requested_by")
    .eq("organization_id", organization!.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const requesterIds = [...new Set((data ?? []).map((row) => row.requested_by).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", requesterIds);
    (profiles ?? []).forEach((person) => names.set(person.id, person.full_name || person.email));
  }

  const rows: ReportListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as ReportKind,
    from: row.date_from,
    to: row.date_to,
    status: row.status,
    format: row.format,
    rowCount: row.row_count,
    error: row.error,
    createdAt: row.created_at,
    requesterName: row.requested_by ? (names.get(row.requested_by) ?? null) : null,
  }));

  const kindCounts = REPORT_KINDS.reduce(
    (counts, kind) => ({ ...counts, [kind]: rows.filter((row) => row.kind === kind && row.status === "ready").length }),
    {} as Record<ReportKind, number>,
  );

  const ready = rows.filter((row) => row.status === "ready").length;

  return (
    <PageShell
      eyebrow="Configure / Evidence"
      title="Reports"
      description={`Regulator-ready exports for ${organization!.name}. Every generation is recorded in the audit log with its requester and row count.`}
      meta={
        <>
          <span className="num">{rows.length} generated</span>
          <span className="num text-risk-low">{ready} ready</span>
          <span className="num">{rows.filter((row) => row.status === "failed").length} failed</span>
        </>
      }
    >
      <ReportsPanel rows={rows} role={profile.role} kindCounts={kindCounts} />
    </PageShell>
  );
}
