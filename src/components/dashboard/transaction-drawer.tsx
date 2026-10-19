"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Network } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionDetail } from "@/lib/data/transactions";
import { cn, formatAmount, formatCurrency } from "@/lib/utils";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

export function TransactionDrawer({
  transactionId,
  onClose,
}: {
  transactionId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<TransactionDetail | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!transactionId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setError("");
    setDetail(null);
    fetch(`/api/transactions/${transactionId}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { data: TransactionDetail | null; error: { message: string } | null };
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load the transaction.");
        setDetail(payload.data);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load the transaction.");
      });
    return () => controller.abort();
  }, [transactionId]);

  const factors = detail?.riskFactors ?? [];
  const maxPoints = Math.max(1, ...factors.map((factor) => factor.points));

  return (
    <Sheet open={Boolean(transactionId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Transaction detail</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.externalId} · ${formatWhen(detail.createdAt)}` : "Loading the scoring record…"}
          </SheetDescription>
        </SheetHeader>

        {error ? <p role="alert" className="text-sm text-risk-critical">{error}</p> : null}

        {!detail && !error ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
        ) : null}

        {detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-border p-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="num text-[20px] font-semibold leading-7 tracking-[-0.02em]">
                  {formatAmount(detail.amount, detail.currency)}
                </p>
                {detail.currency !== "USD" ? (
                  <p className="num text-xs text-muted-foreground">
                    ≈ {formatCurrency(detail.amountBase, "USD")}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="num font-display text-2xl font-semibold">{Math.round(detail.riskScore)}</p>
                <RiskBadge level={detail.riskLevel} className="mt-1" />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Sender</dt>
                <dd className="font-medium">{detail.senderName}</dd>
                <dd className="num text-muted-foreground">{detail.senderCountry}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Receiver</dt>
                <dd className="font-medium">{detail.receiverName}</dd>
                <dd className="num text-muted-foreground">{detail.receiverCountry}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Channel</dt>
                <dd className="num">{detail.channel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purpose</dt>
                <dd className="num">{detail.purposeCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Model</dt>
                <dd className="num">{detail.modelVersion ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scoring time</dt>
                <dd className="num">{detail.scoreMs ? `${detail.scoreMs} ms` : "—"}</dd>
              </div>
            </dl>

            <section aria-labelledby="breakdown-heading">
              <h3 id="breakdown-heading" className="text-sm font-semibold">Why this score</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Weighted contribution of each triggered signal. Bars are proportional to points.
              </p>
              {factors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No signal crossed the reporting threshold.</p>
              ) : (
                <ul className="space-y-2.5">
                  {factors.map((factor) => (
                    <li key={factor.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{factor.label}</span>
                        <span className="num text-muted-foreground">{factor.points.toFixed(1)} pts</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", factor.triggered ? "bg-risk-high" : "bg-foreground/30")}
                          style={{ width: `${(factor.points / maxPoints) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{factor.narrative}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail.alerts.length > 0 ? (
              <section aria-labelledby="tx-alerts-heading">
                <h3 id="tx-alerts-heading" className="text-sm font-semibold">Alerts</h3>
                <ul className="mt-2 space-y-1.5">
                  {detail.alerts.map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href={`/app/alerts/${alert.id}`}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                      >
                        <RiskBadge level={alert.severity} />
                        <span className="min-w-0 flex-1 truncate">{alert.title}</span>
                        <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="related-heading">
              <h3 id="related-heading" className="text-sm font-semibold">Related transactions</h3>
              <ul className="mt-2 divide-y divide-border rounded-card border border-border">
                {detail.related.length === 0 ? (
                  <li className="px-3 py-4 text-xs text-muted-foreground">No other transfers from this account.</li>
                ) : (
                  detail.related.map((row) => (
                    <li key={row.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="num w-20 text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit" }).format(new Date(row.createdAt))}
                      </span>
                      <span className="num w-16">{row.senderCountry}→{row.receiverCountry}</span>
                      <span className="num flex-1 text-right">{formatAmount(row.amount, row.currency)}</span>
                      <span className="num w-8 text-right">{Math.round(row.riskScore)}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/network?account=${detail.id}`}>
                  <Network aria-hidden="true" /> Open in network
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
