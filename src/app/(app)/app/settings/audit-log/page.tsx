import type { Metadata } from "next";
import Link from "next/link";

import { AuditFilters } from "@/components/settings/audit-filters";
import { requireRole } from "@/lib/auth";
import { getAuditActions, getAuditEntries, getTeamMembers } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

function summarise(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 3)
    .map(([key, value]) => {
      if (typeof value === "object") return `${key}: ${JSON.stringify(value).slice(0, 60)}`;
      return `${key}: ${String(value)}`;
    });
  return entries.length > 0 ? entries.join(" · ") : "—";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const params = await searchParams;
  const { supabase, organization } = await requireRole(["admin"]);
  const organizationId = organization!.id;

  const [entries, actions, members] = await Promise.all([
    getAuditEntries(supabase, organizationId, {
      action: params.action?.slice(0, 80),
      actorId: params.actor?.slice(0, 64),
      limit: 250,
    }),
    getAuditActions(supabase, organizationId),
    getTeamMembers(supabase, organizationId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Audit log</h2>
          <p className="text-sm text-muted-foreground">
            Append-only record of every change in {organization!.name}. Admins only.
          </p>
        </div>
        <Link href="/app/reports" className="text-xs underline decoration-accent decoration-2 underline-offset-4">
          Export as a report
        </Link>
      </div>

      <AuditFilters
        actions={actions}
        members={members.map((member) => ({ id: member.id, label: member.fullName || member.email }))}
        active={{ action: params.action, actor: params.actor }}
      />

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Audit events, newest first.</caption>
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">When (UTC)</th>
              <th scope="col" className="px-3 py-2 font-medium">Actor</th>
              <th scope="col" className="px-3 py-2 font-medium">Action</th>
              <th scope="col" className="px-3 py-2 font-medium">Target</th>
              <th scope="col" className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border/60 last:border-0">
                <td className="num whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-xs">{entry.actorName}</td>
                <td className="px-3 py-2.5">
                  <span className="num rounded bg-muted px-1.5 py-0.5 text-[11px]">{entry.action}</span>
                </td>
                <td className="num px-3 py-2.5 text-[11px] text-muted-foreground">
                  {entry.targetType}
                  {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{summarise(entry.metadata)}</td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No entries match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing the latest {entries.length} entries. The table is append-only: entries can be added but never edited or
        removed.
      </p>
    </div>
  );
}
