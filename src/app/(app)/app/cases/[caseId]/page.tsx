import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CaseWorkspace } from "@/components/dashboard/case-workspace";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { requireOrganization } from "@/lib/auth";
import { CASE_PRIORITY_LABELS, CASE_STATUS_LABELS, getAssignableCaseOwners, getCaseDetail } from "@/lib/data/cases";
import { relativeTime } from "@/lib/format";
import { cn, formatAmount, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Case detail" };

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { supabase, profile, organization } = await requireOrganization();
  const [detail, owners] = await Promise.all([
    getCaseDetail(supabase, organization!.id, caseId),
    getAssignableCaseOwners(supabase, organization!.id),
  ]);
  if (!detail) notFound();

  const { case: caseRow, alerts, notes, entities } = detail;
  const totalValue = alerts.reduce((total, alert) => total + alert.amountBase, 0);

  return (
    <div className="mx-auto w-full max-w-[1560px] workspace-stack">
      <div className="flex flex-col gap-2">
        <Link
          href="/app/cases"
          className="inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Cases
        </Link>

        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
                  caseRow.priority === "critical" && "bg-risk-critical/15 text-risk-critical",
                  caseRow.priority === "high" && "bg-risk-high/15 text-risk-high",
                  caseRow.priority === "medium" && "bg-risk-medium/15 text-risk-medium",
                  caseRow.priority === "low" && "bg-risk-low/15 text-risk-low",
                )}
              >
                {CASE_PRIORITY_LABELS[caseRow.priority]} priority
              </span>
              <span className="rounded-[5px] bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                {CASE_STATUS_LABELS[caseRow.status]}
              </span>
            </div>
            <h1 className="mt-2 text-[21px] font-semibold leading-7 tracking-[-0.02em]">{caseRow.title}</h1>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted-foreground">
              {caseRow.summary || "No summary recorded for this case yet."}
            </p>
          </div>
          <div className="toolbar shrink-0">
            <Button variant="outline" size="sm" className="h-8 text-[12px]" asChild>
              <Link href="/app/alerts">Alert queue</Link>
            </Button>
          </div>
        </div>
      </div>

      <dl className="panel grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        {[
          { label: "Owner", value: detail.ownerName ?? "Unassigned", hint: "single accountable analyst" },
          { label: "Opened", value: relativeTime(caseRow.created_at), hint: `updated ${relativeTime(caseRow.updated_at)}` },
          { label: "Linked alerts", value: String(alerts.length), hint: `${entities.length} entities attached` },
          {
            label: "Exposure",
            value: formatCurrency(totalValue, "USD", { maximumFractionDigits: 0 }),
            hint: "sum of linked alert value",
            tone: totalValue >= 50_000 ? "critical" : undefined,
          },
        ].map((item) => (
          <div key={item.label} className="min-w-0 px-4 py-3.5">
            <dt className="label-xs">{item.label}</dt>
            <dd
              className={cn(
                "metric-value mt-1 truncate",
                item.tone === "critical" && "text-risk-critical",
              )}
            >
              {item.value}
            </dd>
            {item.hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.hint}</p> : null}
          </div>
        ))}
      </dl>

      <div className="workspace-row lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section aria-labelledby="case-alerts" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="case-alerts" className="panel-title">
                  Linked alerts
                </h2>
                <p className="panel-caption mt-0.5">Every detection this case is responsible for</p>
              </div>
              <span className="num panel-caption">{alerts.length}</span>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                No alerts linked yet. Link one from an alert page, or paste an alert id in the case panel.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {alerts.map((alert) => (
                  <li key={alert.alertId} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12px]">
                    <RiskBadge level={alert.severity} />
                    <Link
                      href={`/app/alerts/${alert.alertId}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {alert.title}
                    </Link>
                    <span className="num text-muted-foreground">{alert.corridor}</span>
                    <span className="num w-28 text-right">{formatAmount(alert.amount, alert.currency)}</span>
                    <span className="num w-20 text-right text-muted-foreground">
                      {alert.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="case-notes" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="case-notes" className="panel-title">
                  Case file
                </h2>
                <p className="panel-caption mt-0.5">
                  Notes are immutable and attributed, which is what examiners expect
                </p>
              </div>
              <span className="num panel-caption">{notes.length} notes</span>
            </div>
            {notes.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Nothing recorded yet. Add the first note from the case panel.
              </p>
            ) : (
              <ol className="divide-y divide-border/60">
                {notes.map((note) => (
                  <li key={note.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{note.authorName}</span>
                      <time dateTime={note.createdAt}>{relativeTime(note.createdAt)}</time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6">{note.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {entities.length > 0 ? (
            <section aria-labelledby="case-entities" className="panel">
              <div className="panel-head">
                <div>
                  <h2 id="case-entities" className="panel-title">
                    Linked entities
                  </h2>
                  <p className="panel-caption mt-0.5">Counterparties carried in from the linked alerts</p>
                </div>
              </div>
              <ul className="flex flex-wrap gap-2 px-4 py-4">
                {entities.map((entity) => (
                  <li key={entity.id} className="flex items-center gap-2 rounded-[6px] border border-border px-2.5 py-1 text-[12px]">
                    <span className="num text-muted-foreground">{entity.country}</span>
                    <span>{entity.legalName}</span>
                    {entity.pepFlag ? (
                      <span className="rounded-[4px] bg-risk-critical/15 px-1 text-[11px] font-medium text-risk-critical">
                        PEP
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <section aria-labelledby="case-controls" className="panel">
          <div className="panel-head">
            <div>
              <h2 id="case-controls" className="panel-title">
                Case controls
              </h2>
              <p className="panel-caption mt-0.5">Status, priority, owner and case notes</p>
            </div>
          </div>
          <div className="px-4 py-4">
            <CaseWorkspace
              caseId={caseRow.id}
              status={caseRow.status}
              priority={caseRow.priority}
              ownerId={caseRow.owner_id}
              owners={owners.map((owner) => ({ id: owner.id, full_name: owner.full_name, email: owner.email }))}
              role={profile.role}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
