import type { Metadata } from "next";

import { PageShell } from "@/components/app/page-shell";
import { CaseBoard } from "@/components/dashboard/case-board";
import { requireOrganization } from "@/lib/auth";
import { listCases } from "@/lib/data/cases";

export const metadata: Metadata = { title: "Cases" };

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { supabase, profile, organization } = await requireOrganization();
  const rows = await listCases(supabase, organization!.id, {
    status: params.status,
    priority: params.priority,
    q: params.q?.slice(0, 80),
  });

  return (
    <PageShell
      eyebrow="Investigate / Casework"
      title="Cases"
      description={`Investigation files for ${organization!.name}, newest activity first. Every case links its alerts, payments and notes into one auditable record.`}
      meta={
        <>
          <span className="chip">
            <span className="num">{rows.length}</span> {rows.length === 1 ? "case" : "cases"}
          </span>
          <span className="chip">
            <span className="num">{rows.filter((row) => row.status === "open").length}</span> open
          </span>
          <span className="chip">
            <span className="num">{rows.filter((row) => row.status === "in_review").length}</span> in review
          </span>
          <span className="chip">
            <span className="num">{rows.filter((row) => row.priority === "critical").length}</span> critical
          </span>
        </>
      }
    >
      <CaseBoard
        rows={rows}
        filters={{ status: params.status, priority: params.priority, q: params.q }}
        role={profile.role}
      />
    </PageShell>
  );
}
