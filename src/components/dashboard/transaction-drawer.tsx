"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Network } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { RISK_COLORS, scoreToLevel } from "@/config/risk";
import type { TransactionDetail } from "@/lib/data/transactions";
import { cn, formatAmount, formatCurrency } from "@/lib/utils";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

/**
 * Score dial for the drawer header. The arc draws itself once the sheet
 * mounts, so opening a transaction reads as a decision being rendered rather
 * than a number being looked up.
 */
function ScoreRing({ score, tone }: { score: number; tone: string }) {
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="relative shrink-0" aria-hidden="true">
      <span
        className="absolute inset-3 rounded-full blur-2xl"
        style={{ background: tone, opacity: 0.22 }}
      />
      <svg viewBox="0 0 104 104" className="relative size-[104px] -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="rgb(var(--muted) / 0.6)" strokeWidth="4" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
          style={{
            strokeDashoffset: drawn ? offset : circumference,
            filter: `drop-shadow(0 0 6px ${tone}99)`,
          }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num font-display text-[27px] font-semibold leading-none tracking-[-0.04em]">
          {Math.round(score)}
        </span>
        <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          score
        </span>
      </span>
    </div>
  );
}

/** One side of the payment flow: who sent it, or who received it. */
function PartyCard({
  eyebrow,
  name,
  country,
  align,
  delay,
}: {
  eyebrow: string;
  name: string;
  country: string;
  align: "left" | "right";
  delay: number;
}) {
  return (
    <div
      className="anim-rise min-w-0 rounded-card border border-border/70 bg-elevated/40 px-3.5 py-3"
      style={{ "--d": delay } as React.CSSProperties}
    >
      <p
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
          align === "right" && "text-right",
        )}
      >
        {eyebrow}
      </p>
      <p
        className={cn(
          "mt-1.5 truncate text-[13px] font-medium leading-4",
          align === "right" && "text-right",
        )}
        title={name}
      >
        {name}
      </p>
      <p className={cn("num mt-1 text-[11px] text-muted-foreground", align === "right" && "text-right")}>
        {country}
      </p>
    </div>
  );
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
  const fired = factors.filter((factor) => factor.triggered).length;
  const tone = detail ? RISK_COLORS[detail.riskLevel] : "rgb(var(--accent))";

  return (
    <Sheet open={Boolean(transactionId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="sr-only">Transaction detail</SheetTitle>
          <SheetDescription className="sr-only">
            {detail
              ? `Decision record for ${detail.externalId}, scored ${formatWhen(detail.createdAt)}.`
              : "Loading the scoring record…"}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <p role="alert" className="rounded-card border border-risk-critical/30 bg-risk-critical/10 px-4 py-3 text-sm text-risk-critical">
            {error}
          </p>
        ) : null}

        {!detail && !error ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-28 rounded-hero" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-44 rounded-card" />
          </div>
        ) : null}

        {detail ? (
          <div className="space-y-5 pt-1">
            {/* Decision hero: corridor, amount and the dial that draws itself. */}
            <section
              aria-label="Decision summary"
              className="anim-rise relative isolate overflow-hidden rounded-hero border border-border bg-card px-5 py-5"
              style={{ "--d": 40 } as React.CSSProperties}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-14 size-48 rounded-full blur-3xl"
                style={{ background: tone, opacity: 0.14 }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-mono text-[12px] font-medium text-muted-foreground">
                    <span className="text-foreground">{detail.senderCountry}</span>
                    <ArrowRight className="size-3.5 text-accent" aria-hidden="true" />
                    <span className="text-foreground">{detail.receiverCountry}</span>
                    <span className="text-border-strong" aria-hidden="true">·</span>
                    <span className="truncate">{detail.channel}</span>
                  </p>
                  <p className="num mt-3 font-display text-[30px] font-semibold leading-9 tracking-[-0.03em]">
                    {formatAmount(detail.amount, detail.currency)}
                  </p>
                  {detail.currency !== "USD" ? (
                    <p className="num mt-1 text-[11.5px] text-muted-foreground">
                      ≈ {formatCurrency(detail.amountBase, "USD")} at ingestion
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <RiskBadge level={detail.riskLevel} />
                    <span className="num text-[11px] text-muted-foreground">{formatWhen(detail.createdAt)}</span>
                  </div>
                </div>
                <ScoreRing score={detail.riskScore} tone={tone} />
              </div>
            </section>

            {/* The payment, as a flow. */}
            <section aria-label="Parties" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <PartyCard eyebrow="From" name={detail.senderName} country={detail.senderCountry} align="left" delay={140} />
              <span
                className="anim-fade flex size-7 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent"
                style={{ "--d": 260 } as React.CSSProperties}
                aria-hidden="true"
              >
                <ArrowRight className="size-3.5" />
              </span>
              <PartyCard eyebrow="To" name={detail.receiverName} country={detail.receiverCountry} align="right" delay={200} />
            </section>

            {/* Readout facts, set like instrument labels. */}
            <dl
              className="anim-rise flex flex-wrap gap-2"
              style={{ "--d": 300 } as React.CSSProperties}
            >
              {[
                { label: "Purpose", value: detail.purposeCode ?? "—" },
                { label: "Model", value: detail.modelVersion ?? "—" },
                { label: "Scored in", value: detail.scoreMs ? `${detail.scoreMs} ms` : "—" },
                { label: "Reference", value: detail.externalId },
              ].map((fact) => (
                <div key={fact.label} className="readout-pill gap-3">
                  <span className="uppercase tracking-[0.1em]">{fact.label}</span>
                  <span className="num text-foreground/90">{fact.value}</span>
                </div>
              ))}
            </dl>

            <section aria-labelledby="breakdown-heading">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id="breakdown-heading" className="text-sm font-semibold">
                  Why this score
                </h3>
                <p className="num text-[11px] text-muted-foreground">
                  {fired} of {factors.length} signals fired
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Weighted contribution of each signal; bars are proportional to points.
              </p>
              {factors.length === 0 ? (
                <p className="mt-3 rounded-card border border-border/70 bg-elevated/40 px-4 py-3 text-xs text-muted-foreground">
                  No signal crossed the reporting threshold — this payment stays monitoring-only.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {factors.map((factor, index) => (
                    <li key={factor.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("font-medium", !factor.triggered && "text-muted-foreground")}>
                          {factor.label}
                        </span>
                        <span className="num text-muted-foreground">{factor.points.toFixed(1)} pts</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                        <div
                          className={cn(
                            "anim-grow-x h-full rounded-full",
                            factor.triggered
                              ? "shadow-[0_0_10px_-2px_rgba(251,146,60,0.9)]"
                              : "bg-foreground/20",
                          )}
                          style={
                            {
                              width: `${Math.max(2, (factor.points / maxPoints) * 100)}%`,
                              background: factor.triggered ? tone : undefined,
                              "--d": 380 + index * 90,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {factor.narrative}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail.alerts.length > 0 ? (
              <section aria-labelledby="tx-alerts-heading">
                <h3 id="tx-alerts-heading" className="text-sm font-semibold">
                  Alerts
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {detail.alerts.map((alert, index) => (
                    <li key={alert.id}>
                      <Link
                        href={`/app/alerts/${alert.id}`}
                        className="anim-rise group flex items-center gap-2.5 rounded-card border border-border/70 bg-elevated/30 px-3.5 py-2.5 text-xs transition-colors hover:border-border-strong hover:bg-elevated/60"
                        style={{ "--d": 500 + index * 90 } as React.CSSProperties}
                      >
                        <RiskBadge level={alert.severity} />
                        <span className="min-w-0 flex-1 truncate font-medium">{alert.title}</span>
                        <ExternalLink
                          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="related-heading">
              <h3 id="related-heading" className="text-sm font-semibold">
                Related transactions
              </h3>
              <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-card border border-border/70">
                {detail.related.length === 0 ? (
                  <li className="px-3.5 py-4 text-xs text-muted-foreground">
                    No other transfers from this account.
                  </li>
                ) : (
                  detail.related.map((row, index) => {
                    const level = scoreToLevel(row.riskScore);
                    return (
                      <li
                        key={row.id}
                        className="anim-rise flex items-center gap-2 px-3.5 py-2 text-xs transition-colors hover:bg-elevated/50"
                        style={{ "--d": 560 + index * 70 } as React.CSSProperties}
                      >
                        <span className="num w-16 text-muted-foreground">
                          {new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit" }).format(
                            new Date(row.createdAt),
                          )}
                        </span>
                        <span className="num w-16 text-muted-foreground">
                          {row.senderCountry}→{row.receiverCountry}
                        </span>
                        <span className="num flex-1 text-right font-medium">
                          {formatAmount(row.amount, row.currency)}
                        </span>
                        <span
                          className="num w-8 text-right font-semibold"
                          style={{ color: RISK_COLORS[level] }}
                        >
                          {Math.round(row.riskScore)}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button size="sm" asChild>
                <Link href={`/app/transactions/${detail.id}`}>
                  <ExternalLink aria-hidden="true" /> Open workbench
                </Link>
              </Button>
              {detail.senderEntityId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/network/${detail.senderEntityId}`}>
                    <Network aria-hidden="true" /> Sender profile
                  </Link>
                </Button>
              ) : null}
              {detail.receiverEntityId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/network/${detail.receiverEntityId}`}>
                    <Network aria-hidden="true" /> Receiver profile
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
