import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";

import { AlertActions } from "@/components/dashboard/alert-actions";
import { AlertTimeline } from "@/components/dashboard/alert-timeline";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { requireOrganization } from "@/lib/auth";
import { getAlertDetail, getAssignableMembers } from "@/lib/data/alerts";
import { slaLabel, slaState, STATUS_LABELS } from "@/lib/alerts/transitions";
import { cn, formatAmount, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Alert detail" };

const utcDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );

export default async function AlertDetailPage({ params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params;
  const { supabase, profile, organization } = await requireOrganization();
  const [detail, members] = await Promise.all([
    getAlertDetail(supabase, organization!.id, alertId),
    getAssignableMembers(supabase, organization!.id),
  ]);
  if (!detail) notFound();

  const { alert, transaction, factors, related } = detail;
  const state = slaState(alert.due_at);
  const maxPoints = Math.max(1, ...factors.map((factor) => factor.points));
  const triggered = factors.filter((factor) => factor.triggered);

  return (
    <div className="mx-auto w-full max-w-[1560px] workspace-stack">
      <div className="flex flex-col gap-2">
        <Link
          href="/app/alerts"
          className="inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Alert queue
        </Link>

        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={alert.severity} />
              <span className="rounded-[5px] bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                {STATUS_LABELS[alert.status]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[11px]",
                  state === "breached" && "bg-risk-critical/10 text-risk-critical",
                  state === "warning" && "bg-risk-medium/15 text-risk-medium",
                  state === "ok" && "bg-risk-low/10 text-risk-low",
                  state === "none" && "bg-muted text-muted-foreground",
                )}
              >
                <Clock className="size-3" aria-hidden="true" />
                {slaLabel(alert.due_at)}
              </span>
            </div>
            <h1 className="mt-2 text-[21px] font-semibold leading-7 tracking-[-0.02em]">{alert.title}</h1>
            <p className="num mt-1 text-[11px] text-muted-foreground">
              {alert.id.slice(0, 8)} · created {utcDateTime(alert.created_at)} UTC ·{" "}
              {detail.assigneeName ? `assigned to ${detail.assigneeName}` : "unassigned"}
            </p>
          </div>
          {transaction ? (
            <div className="toolbar shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-[12px]" asChild>
                <Link href={`/app/transactions?q=${encodeURIComponent(transaction.external_id)}`}>
                  Open transaction
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {alert.summary ? (
        <p className="panel px-4 py-3 text-[13px] leading-6 text-foreground">{alert.summary}</p>
      ) : null}

      <dl className="panel grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        {[
          {
            label: "Amount",
            value: transaction ? formatAmount(Number(transaction.amount), transaction.currency) : "—",
            hint: transaction ? `≈ ${formatCurrency(Number(transaction.amount_base), "USD")} base` : undefined,
          },
          {
            label: "Risk score",
            value: transaction ? String(Math.round(Number(transaction.risk_score))) : "—",
            hint: `model ${detail.modelVersion}`,
          },
          {
            label: "Corridor",
            value: transaction ? `${transaction.sender_country}→${transaction.receiver_country}` : "—",
            hint: transaction?.channel ?? undefined,
          },
          {
            label: "Signals triggered",
            value: `${triggered.length}`,
            hint: `${factors.length} evaluated`,
          },
        ].map((item) => (
          <div key={item.label} className="min-w-0 px-4 py-3.5">
            <dt className="label-xs">{item.label}</dt>
            <dd className="metric-value mt-1 truncate">{item.value}</dd>
            {item.hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.hint}</p> : null}
          </div>
        ))}
      </dl>

      <div className="workspace-row lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section aria-labelledby="explanation-heading" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="explanation-heading" className="panel-title">
                  Why this score
                </h2>
                <p className="panel-caption mt-0.5">
                  Weighted contribution of every evaluated signal, highest first
                </p>
              </div>
            </div>
            <div className="space-y-4 px-4 py-4">
              {detail.explanation && detail.explanation !== alert.summary ? (
                <p className="text-[13px] leading-6 text-muted-foreground">{detail.explanation}</p>
              ) : null}
              <ul className="space-y-3.5">
                {factors.map((factor) => (
                  <li key={factor.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-2 font-medium">
                        {factor.triggered ? (
                          <span className="size-1.5 rounded-full bg-risk-high" aria-hidden="true" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                        )}
                        {factor.label}
                      </span>
                      <span className="num text-muted-foreground">{factor.points.toFixed(1)} pts</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", factor.triggered ? "bg-risk-high" : "bg-foreground/25")}
                        style={{ width: `${Math.max(2, (factor.points / maxPoints) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{factor.narrative}</p>
                    <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(factor.facts)
                        .filter(
                          ([, value]) =>
                            typeof value === "number" || typeof value === "string" || typeof value === "boolean",
                        )
                        .slice(0, 5)
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-baseline gap-1 rounded-[5px] bg-muted/60 px-1.5 py-0.5 text-[10px]"
                          >
                            <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                            <dd className="num text-foreground">{String(value)}</dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="transaction-heading" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="transaction-heading" className="panel-title">
                  Linked payment
                </h2>
                <p className="panel-caption mt-0.5">Immutable record as it arrived at ingestion</p>
              </div>
              {transaction ? (
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" asChild>
                  <Link href={`/app/transactions?q=${encodeURIComponent(transaction.external_id)}`}>Inspect</Link>
                </Button>
              ) : null}
            </div>
            {transaction ? (
              <dl className="grid gap-x-6 gap-y-3 px-4 py-4 text-[12px] sm:grid-cols-3">
                {[
                  { label: "External id", value: transaction.external_id },
                  { label: "Channel", value: transaction.channel },
                  { label: "Purpose", value: transaction.purpose_code ?? "—" },
                  { label: "Sender", value: `${transaction.sender_name} · ${transaction.sender_country}` },
                  { label: "Receiver", value: `${transaction.receiver_name} · ${transaction.receiver_country}` },
                  { label: "Status", value: transaction.status },
                  { label: "Settled (UTC)", value: utcDateTime(transaction.created_at) },
                  {
                    label: "Base value",
                    value: formatCurrency(Number(transaction.amount_base), "USD"),
                  },
                  { label: "Scoring model", value: detail.modelVersion },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="label-xs">{item.label}</dt>
                    <dd className="num mt-0.5 truncate" title={item.value}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-4 text-[12px] text-muted-foreground">
                The linked transaction is no longer available.
              </p>
            )}
          </section>

          <section aria-labelledby="related-heading" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="related-heading" className="panel-title">
                  Other payments from this sender
                </h2>
                <p className="panel-caption mt-0.5">Context for whether this alert is isolated or part of a pattern</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[520px]">
                <caption className="sr-only">Related transactions from the same sender account</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Corridor</th>
                    <th scope="col" className="text-right">Amount</th>
                    <th scope="col" className="text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {related.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td className="num text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit", timeZone: "UTC" }).format(
                          new Date(row.createdAt),
                        )}
                      </td>
                      <td className="num">
                        {row.senderCountry}→{row.receiverCountry}
                      </td>
                      <td className="num text-right">{formatAmount(row.amount, row.currency)}</td>
                      <td className="num text-right">{Math.round(row.riskScore)}</td>
                    </tr>
                  ))}
                  {related.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No other transfers for this sender account.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="workflow-heading" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="workflow-heading" className="panel-title">
                  Triage
                </h2>
                <p className="panel-caption mt-0.5">Every change writes an audit event</p>
              </div>
            </div>
            <div className="px-4 py-4">
              <AlertActions
                alertId={alert.id}
                status={alert.status}
                assigneeId={alert.assignee_id}
                members={members.map((member) => ({ id: member.id, full_name: member.full_name, email: member.email }))}
                role={profile.role}
              />
            </div>
          </section>

          <section aria-labelledby="timeline-heading" className="panel">
            <div className="panel-head">
              <div>
                <h2 id="timeline-heading" className="panel-title">
                  Activity
                </h2>
                <p className="panel-caption mt-0.5">{detail.events.length} recorded events</p>
              </div>
            </div>
            <div className="px-4 py-4">
              <AlertTimeline events={detail.events} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
