import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleDot, Database, Gauge, Timer } from "lucide-react";

import { MetricRow, MetricTile } from "@/components/app/page-shell";
import { ReadoutRail } from "@/components/dashboard/overview-panels";
import { AmountLadder, ScoreDial, ScoreSimulator } from "@/components/dashboard/score-workbench";
import {
  CorridorFlow,
  ScoreBuild,
  ScorePlacement,
} from "@/components/dashboard/transaction-graphics";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { ALERT_CUTOFF, RISK_COLORS, REPORTING_THRESHOLD_USD, scoreToLevel } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getTransactionDetail } from "@/lib/data/transactions";
import { clampScore, decisionFor, percentileRank, totalSignalWeight } from "@/lib/risk/dossier";
import { cn, formatAmount, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Transaction workbench" };

function when(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

function shortWhen(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value))}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

const DECISION_TONE: Record<string, string> = {
  block: "border-risk-critical/40 bg-risk-critical/10 text-risk-critical",
  review: "border-risk-medium/40 bg-risk-medium/10 text-risk-medium",
  clear: "border-risk-low/40 bg-risk-low/10 text-risk-low",
};

export default async function TransactionWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organization } = await requireOrganization();
  const detail = await getTransactionDetail(supabase, organization!.id, id);

  if (!detail) notFound();

  const factors = [...detail.riskFactors].sort((a, b) => b.points - a.points);
  const triggered = factors.filter((factor) => factor.triggered);
  const peerAmounts = detail.related.map((row) => row.amountBase);
  const peerScores = detail.related.map((row) => row.riskScore);
  const peerMedian = median(peerAmounts);
  const peerMax = Math.max(detail.amountBase, ...(peerAmounts.length ? peerAmounts : [0]));
  const level = scoreToLevel(detail.riskScore);
  const aboveThreshold = detail.amountBase >= REPORTING_THRESHOLD_USD;
  const decision = decisionFor(detail.riskScore, detail.alerts);
  const totalWeight = totalSignalWeight();
  const pointsStored = factors.reduce((sum, factor) => sum + factor.points, 0);
  const population = [detail.amountBase, ...peerAmounts];
  const amountPercentile = percentileRank(population, detail.amountBase);
  const scorePercentile = percentileRank([detail.riskScore, ...peerScores], detail.riskScore);
  const cutoffDistance = Math.round(detail.riskScore) - ALERT_CUTOFF;

  return (
    <div className="workspace-stack mx-auto w-full max-w-[1560px]">
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

      {/* Command band: the payment's journey, its score, and the readouts a
          reviewer checks before opening anything else. */}
      <section aria-label="Payment summary" className="overview-band">
        <div className="grid gap-0 lg:grid-cols-12">
          <div className="px-6 py-6 lg:col-span-6 lg:px-8 lg:py-7">
            <p className="label-xs">
              {detail.senderCountry} → {detail.receiverCountry} · {detail.purposeCode ?? "no purpose code"}
            </p>
            <h1 className="mt-1.5 font-display text-[27px] font-semibold leading-9 tracking-[-0.035em]">
              {formatAmount(detail.amount, detail.currency)}
            </h1>
            <p className="num mt-1 text-[11.5px] text-muted-foreground">
              {detail.externalId} · {when(detail.createdAt)}
            </p>

            <div className="mt-4">
              <CorridorFlow
                senderCountry={detail.senderCountry}
                receiverCountry={detail.receiverCountry}
                senderName={detail.senderName}
                receiverName={detail.receiverName}
                amountLabel={formatAmount(detail.amount, detail.currency)}
                amountBaseLabel={`${formatCurrency(detail.amountBase, "USD", { maximumFractionDigits: 0 })} base`}
                level={level}
                status={detail.status}
                channel={detail.channel}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
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

          <div className="flex items-center gap-5 px-6 py-6 lg:col-span-3 lg:px-8 lg:py-7 overview-band__split">
            <ScoreDial score={detail.riskScore} />
            <div className="space-y-2">
              <RiskBadge level={level} />
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  DECISION_TONE[decision.tone] ?? DECISION_TONE.clear,
                )}
              >
                {decision.code}
              </span>
              <p className="max-w-[190px] text-[11px] leading-4 text-muted-foreground">
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

          <div className="px-6 py-6 lg:col-span-3 lg:px-8 lg:py-7 overview-band__split">
            <ReadoutRail
              items={[
                {
                  key: "cutoff",
                  label: "Distance to the alert cutoff",
                  value: `${cutoffDistance >= 0 ? "+" : ""}${cutoffDistance}`,
                  share: detail.riskScore / 100,
                  color: RISK_COLORS[level],
                  foot: `score ${Math.round(detail.riskScore)} · cutoff ${ALERT_CUTOFF}`,
                },
                {
                  key: "amount",
                  label: "Larger than this share of grouped transfers",
                  value: `${Math.round(amountPercentile * 100)}%`,
                  share: amountPercentile,
                  color: "rgb(var(--chart-1))",
                  foot: `peer median ${peerMedian ? formatCurrency(peerMedian, "USD", { maximumFractionDigits: 0 }) : "—"}`,
                },
                {
                  key: "score",
                  label: "Scored higher than this share of the sender's transfers",
                  value: `${Math.round(scorePercentile * 100)}%`,
                  share: scorePercentile,
                  color: "rgb(var(--risk-medium))",
                  foot: `${detail.related.length} related transfers`,
                },
              ]}
            />
          </div>
        </div>
      </section>

      <MetricRow>
        <MetricTile
          label="Base value"
          value={`$${formatCompactNumber(detail.amountBase)}`}
          hint={aboveThreshold ? "at or above the USD 10,000 reference threshold" : "below the reference threshold"}
          tone={aboveThreshold ? "warning" : "default"}
          definition=""
        />
        <MetricTile
          label="Stored points"
          value={clampScore(pointsStored).toFixed(1)}
          hint={`${Math.min(100, Math.round((pointsStored / Math.max(1, totalWeight)) * 100))}% of the ${totalWeight}-point normaliser`}
          tone="accent"
          definition=""
        />
        <MetricTile
          label="Scoring time"
          value={detail.scoreMs ? `${detail.scoreMs} ms` : "—"}
          hint="server-side rule pass"
          definition=""
        />
        <MetricTile
          label="Related transfers"
          value={detail.related.length.toLocaleString("en-US")}
          hint="same sender account, most recent first"
          definition=""
        />
      </MetricRow>

      {/* Score build: the waterfall that produced this decision, plus the list
          of narratives behind each contribution. */}
      <div className="workspace-row">
        <section aria-labelledby="build-heading" className="panel flex min-w-0 flex-col xl:col-span-7">
          <div className="px-5 pb-1 pt-5">
            <h2 id="build-heading" className="panel-title text-[14px]">
              How the score was built
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Each signal&apos;s points added onto the running total; the dashed line is the alert
              cutoff at {ALERT_CUTOFF}
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <ScoreBuild factors={factors} published={detail.riskScore} />
          </div>
        </section>

        <section aria-labelledby="simulator" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="simulator" className="panel-title text-[14px]">
              Sensitivity simulator
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Move a signal&apos;s strength and watch the published score recompute
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <ScoreSimulator factors={factors} published={detail.riskScore} />
          </div>
        </section>
      </div>

      <section
        id="signals"
        aria-labelledby="signals-heading"
        className="panel min-w-0"
      >
        <div className="px-5 pb-1 pt-5">
          <h2 id="signals-heading" className="panel-title text-[14px]">
            Why this score
          </h2>
          <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
            Weighted contribution of every signal, largest first
          </p>
        </div>
        {factors.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted-foreground">
            No signal contributions were recorded for this payment.
          </p>
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
                                <span key={key} className="num rounded-[5px] border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
      </section>

      {/* Peer placement and amount context: where this payment sits against
          the sender's own history. */}
      <div className="workspace-row">
        <section aria-labelledby="placement-heading" className="panel flex min-w-0 flex-col xl:col-span-7">
          <div className="px-5 pb-1 pt-5">
            <h2 id="placement-heading" className="panel-title text-[14px]">
              Placement among the sender&apos;s transfers
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Score histogram of the {detail.related.length} related transfers, with this payment marked
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <ScorePlacement
              score={detail.riskScore}
              peers={peerScores}
              referenceLabel="same-sender"
            />
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-[11px] sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">This score</p>
                <p className="num mt-0.5 text-[13px]" style={{ color: RISK_COLORS[level] }}>
                  {Math.round(detail.riskScore)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Peer median</p>
                <p className="num mt-0.5 text-[13px]">{median(peerScores) ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Alert cutoff</p>
                <p className="num mt-0.5 text-[13px]">{ALERT_CUTOFF}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rank among peers</p>
                <p className="num mt-0.5 text-[13px]">{Math.round(scorePercentile * 100)}%</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="amount-context" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="amount-context" className="panel-title text-[14px]">
              Amount in context
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Against the reporting threshold and the sender&apos;s recent transfers
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-4">
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
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Older transfers in grey, this payment in <span style={{ color: RISK_COLORS[level] }}>risk colour</span>.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-[11px]">
              <div>
                <p className="text-muted-foreground">USD base value</p>
                <p className="num mt-0.5 text-[13px]">{formatCurrency(detail.amountBase, "USD", { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Original amount</p>
                <p className="num mt-0.5 text-[13px]">{formatAmount(detail.amount, detail.currency)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Pipeline trail, alerts and the sender's other payments. */}
      <div className="workspace-row">
        <section aria-labelledby="timeline" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="timeline" className="panel-title text-[14px]">
              Decision trail
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              What the pipeline recorded, in order
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-4">
            <ol className="relative">
              <span className="absolute bottom-6 left-[10px] top-3 w-px bg-border" aria-hidden="true" />
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
                    <p className="num mt-0.5 text-[11px] leading-4 text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-tile border border-border/70 bg-elevated/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11.5px] font-medium">
                <Timer className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Ingest to score
              </div>
              <p className="num mt-1 text-[19px] font-semibold leading-6 tracking-[-0.03em]">
                {detail.scoreMs ? `${detail.scoreMs} ms` : "not recorded"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {detail.scoredAt
                  ? `Scored ${when(detail.scoredAt)}`
                  : `Ingested ${when(detail.createdAt)}; scoring latency was not stored.`}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="alerts" className="panel flex min-w-0 flex-col xl:col-span-7">
          <div className="px-5 pb-1 pt-5">
            <h2 id="alerts" className="panel-title text-[14px]">
              Linked alerts
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Every alert opened from this payment
            </p>
          </div>
          <div className="min-w-0 flex-1">
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
                      <span className="text-[11px] capitalize text-muted-foreground">{alert.status}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section id="related" aria-labelledby="related-heading" className="panel min-w-0">
        <div className="px-5 pb-1 pt-5">
          <h2 id="related-heading" className="panel-title text-[14px]">
            Related transfers
          </h2>
          <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
            Other payments from the sender account in this dataset
          </p>
        </div>
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
                    <td className="num whitespace-nowrap text-[11px] text-muted-foreground">{shortWhen(row.createdAt)}</td>
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
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[80ch] text-[11px] leading-4 text-muted-foreground">
          The score is the published rule model output stamped at scoring time, not a live
          recalculation. The simulator reuses those stored contributions so a reviewer can see which
          signals the decision rests on.
        </p>
        <Button asChild size="sm" variant="outline" className="h-8 shrink-0 text-[12px]">
          <Link href={`/app/network${detail.senderEntityId ? `/${detail.senderEntityId}` : ""}`}>
            Open the sender in the network
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
