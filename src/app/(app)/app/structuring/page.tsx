import type { Metadata } from "next";
import Link from "next/link";

import { PageSection, PageShell, StatStrip } from "@/components/app/page-shell";
import { EmptyState } from "@/components/states";
import { requireOrganization } from "@/lib/auth";
import { REPORTING_THRESHOLD, getStructuringClusters } from "@/lib/data/structuring";
import { formatDateTime } from "@/lib/format";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Structuring" };

export default async function StructuringPage() {
  const { supabase, organization } = await requireOrganization();
  const report = await getStructuringClusters(supabase, organization!.id);
  const { clusters, stats } = report;

  return (
    <PageShell
      eyebrow="Investigate / Patterns"
      title="Structuring"
      description={`Payments kept just under the ${formatCurrency(REPORTING_THRESHOLD, "USD", { maximumFractionDigits: 0 })} reporting line that together clear it inside ${stats.windowHours} hours. Grouped by the receiving account.`}
      meta={
        <>
          <span className="num">{stats.clusters} clusters</span>
          <span className="num">{formatCompactNumber(stats.totalValue)} USD routed</span>
          <span className="num">{stats.accounts} sending accounts</span>
        </>
      }
    >
      <StatStrip
        items={[
          { label: "Clusters, 90 days", value: stats.clusters, hint: `window of ${stats.windowHours}h` },
          {
            label: "Value routed",
            value: formatCompactNumber(stats.totalValue),
            hint: "USD, sum of clustered transfers",
          },
          {
            label: "Largest window",
            value: formatCompactNumber(stats.largestWindow),
            hint: "single receiver, one window",
            tone: "warning",
          },
          { label: "Sending accounts", value: stats.accounts, hint: "distinct counterparties" },
        ]}
      />

      <PageSection
        id="clusters-heading"
        title="Sub-threshold clusters"
        description="Grouped by receiving account, largest exposure first"
      >
      {clusters.length === 0 ? (
        <EmptyState
          title="No sub-threshold clusters found"
          description={`No receiving account took four or more transfers between USD 8,000 and USD ${REPORTING_THRESHOLD.toLocaleString("en-US")} inside ${stats.windowHours} hours.`}
        />
      ) : (
        <ul className="space-y-2">
          {clusters.map((cluster) => {
            const spanHours = Math.max(
              1,
              Math.round(
                (new Date(cluster.windowEnd).getTime() - new Date(cluster.windowStart).getTime()) / 3_600_000,
              ),
            );
            const maxTransfer = Math.max(...cluster.transfers.map((transfer) => transfer.amount));
            return (
              <li key={cluster.receiverAccountId} className="rounded-card border border-border bg-background/40">
                <details className="group">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-semibold tracking-tight">{cluster.receiverName}</span>
                        <span className="num rounded-pill bg-muted px-2 py-0.5 text-[11px]">{cluster.corridor}</span>
                        <span
                          className={cn(
                            "rounded-pill px-2 py-0.5 text-[11px] font-medium",
                            cluster.averageScore >= 70
                              ? "bg-risk-high/15 text-risk-high"
                              : "bg-risk-medium/20 text-[#6b4a00] dark:text-risk-medium",
                          )}
                        >
                          avg score {cluster.averageScore}
                        </span>
                        {cluster.excessOverThreshold > 0 ? (
                          <span className="text-[11px] text-risk-high">
                            +{formatCurrency(cluster.excessOverThreshold, "USD", { maximumFractionDigits: 0 })} over
                            threshold
                          </span>
                        ) : null}
                      </div>
                      <p className="num mt-1 text-[11px] text-muted-foreground">
                        {cluster.transfers.length} transfers · {cluster.senderCount} senders · {spanHours}h window ·{" "}
                        {formatDateTime(cluster.windowStart)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num font-display text-base">{formatCurrency(cluster.total, "USD", { maximumFractionDigits: 0 })}</p>
                      <p className="num text-[11px] text-muted-foreground">
                        avg {formatCurrency(cluster.averageTicket, "USD", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </summary>

                  <div className="border-t border-border px-4 py-3">
                    <div className="mb-3 flex h-10 items-end gap-1" aria-hidden="true">
                      {cluster.transfers.map((transfer) => (
                        <div
                          key={transfer.id}
                          title={`${formatCurrency(transfer.amount, "USD", { maximumFractionDigits: 0 })} · ${formatDateTime(transfer.createdAt)}`}
                          className={cn(
                            "flex-1 rounded-t-sm",
                            transfer.amount >= REPORTING_THRESHOLD * 0.95 ? "bg-risk-high" : "bg-risk-medium",
                          )}
                          style={{ height: `${Math.max(8, (transfer.amount / maxTransfer) * 100)}%` }}
                        />
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-xs">
                        <caption className="sr-only">
                          Transfers into {cluster.receiverName} that make up this structuring cluster.
                        </caption>
                        <thead className="text-[11.5px] text-muted-foreground">
                          <tr>
                            <th scope="col" className="py-1 font-medium">When</th>
                            <th scope="col" className="py-1 font-medium">Sender</th>
                            <th scope="col" className="py-1 font-medium">External id</th>
                            <th scope="col" className="py-1 text-right font-medium">Amount (USD)</th>
                            <th scope="col" className="py-1 text-right font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cluster.transfers.map((transfer) => (
                            <tr key={transfer.id} className="border-t border-border/60">
                              <td className="num py-1.5 text-muted-foreground">{formatDateTime(transfer.createdAt)}</td>
                              <td className="py-1.5">
                                {transfer.senderName} <span className="num text-muted-foreground">{transfer.senderCountry}</span>
                              </td>
                              <td className="num py-1.5">
                                <Link
                                  href={`/app/transactions?q=${encodeURIComponent(transfer.externalId)}`}
                                  className="underline decoration-accent decoration-2 underline-offset-4"
                                >
                                  {transfer.externalId}
                                </Link>
                              </td>
                              <td className="num py-1.5 text-right">{formatCurrency(transfer.amount, "USD")}</td>
                              <td className="num py-1.5 text-right">{transfer.riskScore}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Largest single transfer {formatCurrency(cluster.largestTransfer, "USD")}. Nothing here individually
                      crosses the reporting line, which is exactly why the cluster matters.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Link
                        href={`/app/transactions?q=${encodeURIComponent(cluster.receiverName)}`}
                        className="underline decoration-accent decoration-2 underline-offset-4"
                      >
                        All transfers to this receiver
                      </Link>
                      <Link
                        href={`/app/cases`}
                        className="underline decoration-accent decoration-2 underline-offset-4"
                      >
                        Open an investigation
                      </Link>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      </PageSection>
    </PageShell>
  );
}
