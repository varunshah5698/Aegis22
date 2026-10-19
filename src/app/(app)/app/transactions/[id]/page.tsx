import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleDot, Database, Gauge } from "lucide-react";

import { MetricRow, MetricTile, PageSection } from "@/components/app/page-shell";
import { AmountLadder, ScoreDial, ScoreSimulator } from "@/components/dashboard/score-workbench";
import { RiskBadge } from "@/components/risk-badge";
import { ALERT_CUTOFF, RISK_COLORS, REPORTING_THRESHOLD_USD, scoreToLevel } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getTransactionDetail } from "@/lib/data/transactions";
import { cn, formatAmount, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Transaction workbench" };

function when(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export default async function TransactionWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organization } = await requireOrganization();
  const detail = await getTransactionDetail(supabase, organization!.id, id);

  if (!detail) notFound();

  const factors = [...detail.riskFactors].sort((a, b) => b.points - a.points);
  const triggered = factors.filter((factor) => factor.triggered);
  const peerAmounts = detail.related.map((row) => row.amountBase);
  const peerMedian = median(peerAmounts);
  const peerMax = Math.max(detail.amountBase, ...(peerAmounts.length ? peerAmounts : [0]));
  const level = scoreToLevel(detail.riskScore);
  const aboveThreshold = detail.amountBase >= REPORTING_THRESHOLD_USD;

  return (
    <div className="workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/transactions"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Transactions
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("chip capitalize", detail.status === "blocked" && "border-risk-critical/40 text-risk-critical")}>
            {detail.status}
          </span>
          <span className="chip">{detail.channel}</span>
          <span className="chip num">{detail.modelVersion ?? "model —"}</span>
        </div>
      </div>

      <header className="grid gap-5 border-b border-border/70 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="label-xs">
            {detail.senderCountry} → {detail.receiverCountry} · {detail.purposeCode ?? "no purpose code"}
          </p>
          <h1 className="mt-1.5 font-display text-[27px] font-semibold leading-9 tracking-[-0.035em]">
            {formatAmount(detail.amount, detail.currency)}
          </h1>
          <p className="num mt-1 text-[11.5px] text-muted-foreground">
            {detail.externalId} · {when(detail.createdAt)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            {detail.senderEntityId ? (
              <Link
                href={`/app/network/${detail.senderEntityId}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-medium transition-colors hover:border-foreground/30"
              >
                {detail.senderName}
                <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden="true" />
              </Link>
            ) : (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">{detail.senderName}</span>
            )}
            <span className="text-muted-foreground" aria-hidden="true">→</span>
            {detail.receiverEntityId ? (
              <Link
                href={`/app/network/${detail.receiverEntityId}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-medium transition-colors hover:border-foreground/30"
              >
                {detail.receiverName}
                <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden="true" />
              </Link>
            ) : (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">{detail.receiverName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ScoreDial score={detail.riskScore} />
          <div className="space-y-2">
            <RiskBadge level={level} />
            <p className="max-w-[210px] text-[11px] leading-4 text-muted-foreground">
              {triggered.length} of {factors.length} signals crossed the reporting threshold.
            </p>
            {detail.alerts.length > 0 ? (
              <Link
                href={`/app/alerts/${detail.alerts[0]!.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground underline-offset-4 hover:underline"
              >
                Open the alert <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <MetricRow>
        <MetricTile
          label="Base value"
          value={`$${formatCompactNumber(detail.amountBase)}`}
          hint={aboveThreshold ? "at or above the USD 10,000 reference threshold" : "below the reference threshold"}
          tone={aboveThreshold ? "warning" : "default"}
        />
        <MetricTile
          label="Peak signal"
          value={factors[0] ? factors[0].points.toFixed(1) : "0"}
          hint={factors[0]?.label ?? "no signal contributions"}
          tone="accent"
        />
        <MetricTile label="Scoring time" value={detail.scoreMs ? `${detail.scoreMs} ms` : "—"} hint="server-side rule pass" />
        <MetricTile
          label="Related transfers"
          value={detail.related.length.toLocaleString("en-US")}
          hint="same sender account, most recent first"
        />
      </MetricRow>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="signals"
          title="Why this score"
          description="Weighted contribution of every signal, largest first"
          className="xl:col-span-7"
          flush
        >
          {factors.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted-foreground">No signal contributions were recorded for this payment.</p>
          ) : (
            <>
            <ul className="divide-y divide-border/60">
              {factors.map((factor) => {
                const width = Math.max(2, (factor.points / Math.max(1, factors[0]!.points)) * 100);
                return (
                  <li key={factor.id} className="px-5 py-3">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="mt-0.5 size-1.5 shrink-0 rounded-full"
                        style={{ background: factor.triggered ? RISK_COLORS.high : "rgb(var(--muted-foreground))" }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[12px] font-medium leading-5">{factor.label}</p>
                          <p className="num shrink-0 text-[11px] text-muted-foreground">{factor.points.toFixed(1)} pts</p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${width}%`,
                              background: factor.triggered ? RISK_COLORS.high : "rgb(var(--foreground) / 0.28)",
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{factor.narrative}</p>
                        {Object.keys(factor.facts ?? {}).length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(factor.facts)
                              .slice(0, 6)
                              .map(([key, value]) => (
                                <span key={key} className="num rounded-[5px] border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {key.replace(/_/g, " ")} {typeof value === "number" ? Math.round(value * 100) / 100 : String(value)}
                                </span>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-border/60 px-5 py-3 text-[11px] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">
                {triggered.length} of {factors.length}
              </span>{" "}
              stored signals crossed their reporting threshold. The largest single contribution is{" "}
              <span className="font-medium text-foreground">{factors[0]!.label.toLowerCase()}</span> at{" "}
              <span className="num text-foreground">{factors[0]!.points.toFixed(1)} pts</span>.
            </p>
            </>
          )}
        </PageSection>

        <PageSection
          id="simulator"
          title="Sensitivity simulator"
          description="Move a signal's strength and watch the published score recompute"
          className="xl:col-span-5"
        >
          <ScoreSimulator factors={factors} published={detail.riskScore} />
        </PageSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <PageSection
          id="amount-context"
          title="Amount in context"
          description="Against the reporting threshold and the sender's recent transfers"
          className="xl:col-span-5"
        >
          <AmountLadder amountBase={detail.amountBase} peerMedian={peerMedian} peerMax={peerMax} />

          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="label-xs">Recent amounts from this sender</p>
            <div className="mt-2 flex h-16 items-end gap-1.5" role="img" aria-label="Bar chart comparing this payment with the sender's other recent transfers">
              {[...detail.related].reverse().slice(-9).map((row) => (
                <span
                  key={row.id}
                  title={`${row.externalId} · ${formatAmount(row.amount, row.currency)}`}
                  className="flex-1 rounded-t-[2px] bg-foreground/25"
                  style={{ height: `${Math.max(6, (row.amountBase / Math.max(1, peerMax)) * 100)}%` }}
                />
              ))}
              <span
                title={`This payment · ${formatAmount(detail.amount, detail.currency)}`}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${Math.max(8, (detail.amountBase / Math.max(1, peerMax)) * 100)}%`,
                  background: RISK_COLORS[level],
                }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Older transfers in grey, this payment in <span style={{ color: RISK_COLORS[level] }}>risk colour</span>.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-[11px]">
            <div>
              <p className="text-muted-foreground">Alert cutoff</p>
              <p className="num mt-0.5 text-[13px]">{ALERT_CUTOFF}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment score</p>
              <p className="num mt-0.5 text-[13px]" style={{ color: RISK_COLORS[level] }}>{Math.round(detail.riskScore)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">USD base value</p>
              <p className="num mt-0.5 text-[13px]">{formatCurrency(detail.amountBase, "USD", { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Original amount</p>
              <p className="num mt-0.5 text-[13px]">{formatAmount(detail.amount, detail.currency)}</p>
            </div>
          </div>
        </PageSection>

        <PageSection
          id="timeline"
          title="Decision trail"
          description="What the pipeline recorded, in order"
          className="xl:col-span-4"
          flush
        >
          <ol className="relative px-5 py-4">
            <span className="absolute bottom-6 left-[26px] top-7 w-px bg-border" aria-hidden="true" />
            {[
              {
                icon: CircleDot,
                title: "Payment ingested",
                detail: when(detail.createdAt),
                done: true,
              },
              {
                icon: Gauge,
                title: `Scored ${Math.round(detail.riskScore)} · ${level}`,
                detail: detail.scoredAt ? `${when(detail.scoredAt)}${detail.scoreMs ? ` · ${detail.scoreMs} ms` : ""}` : "scoring time not recorded",
                done: Boolean(detail.scoredAt),
              },
              {
                icon: Database,
                title: "Signals persisted",
                detail: `${factors.length} contributions stored with model ${detail.modelVersion ?? "—"}`,
                done: factors.length > 0,
              },
              {
                icon: CheckCircle2,
                title: detail.alerts.length > 0 ? `${detail.alerts.length} alert${detail.alerts.length === 1 ? "" : "s"} raised` : "No alert raised",
                detail:
                  detail.alerts.length > 0
                    ? detail.alerts.map((alert) => `${alert.severity} · ${alert.status}`).join(", ")
                    : `score stayed below the ${ALERT_CUTOFF} cutoff`,
                done: true,
              },
            ].map((step) => (
              <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
                <span
                  className={cn(
                    "z-10 flex size-5 shrink-0 items-center justify-center rounded-full border bg-card",
                    step.done ? "border-foreground/25 text-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  <step.icon className="size-3" aria-hidden="true" />
                </span>
                <div className="min-w-0 pb-0.5">
                  <p className="text-[11.5px] font-medium leading-4">{step.title}</p>
                  <p className="num mt-0.5 text-[10.5px] leading-4 text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection
          id="alerts"
          title="Linked alerts"
          description="Every alert opened from this payment"
          className="xl:col-span-3"
          flush
        >
          {detail.alerts.length === 0 ? (
            <p className="px-5 py-6 text-[11.5px] leading-5 text-muted-foreground">
              No alert was opened. The payment stays in monitoring with its full signal record.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {detail.alerts.map((alert) => (
                <li key={alert.id}>
                  <Link href={`/app/alerts/${alert.id}`} className="flex items-center gap-2 px-5 py-3 transition-colors hover:bg-muted/40">
                    <RiskBadge level={alert.severity} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px]">{alert.title}</span>
                    <span className="text-[10.5px] capitalize text-muted-foreground">{alert.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      </div>

      <PageSection
        id="related"
        title="Related transfers"
        description="Other payments from the sender account in this dataset"
        className="min-w-0"
        flush
      >
        {detail.related.length === 0 ? (
          <p className="px-5 py-6 text-[11.5px] text-muted-foreground">No other transfers from this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <caption className="sr-only">Other transfers from the sender account</caption>
              <thead>
                <tr>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Receiver</th>
                  <th scope="col">Corridor</th>
                  <th scope="col" className="text-right">Amount</th>
                  <th scope="col" className="text-right">Score</th>
                  <th scope="col" className="text-right">Level</th>
                </tr>
              </thead>
              <tbody>
                {detail.related.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-[11px] text-muted-foreground">{when(row.createdAt)}</td>
                    <td>
                      <Link href={`/app/transactions/${row.id}`} className="num font-medium underline-offset-4 hover:underline">
                        {row.externalId}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate">{row.receiverName}</td>
                    <td className="num">{row.senderCountry}→{row.receiverCountry}</td>
                    <td className="num whitespace-nowrap text-right">{formatAmount(row.amount, row.currency)}</td>
                    <td className="num text-right">{Math.round(row.riskScore)}</td>
                    <td className="text-right">
                      <RiskBadge level={row.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      <p className="text-[11px] leading-4 text-muted-foreground">
        The score is the published rule model output stamped at scoring time, not a live recalculation. The simulator
        above reuses those stored contributions so a reviewer can see which signals the decision rests on.
      </p>
    </div>
  );
}
