"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScanSearch,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { AnswerBody, EvidenceFooter, type AssistantReply } from "@/components/dashboard/analyst-panel";
import type { Finding } from "@/lib/analytics/findings";
import { cn, formatCompactNumber } from "@/lib/utils";

export interface InsightContext {
  label: string;
  share: number;
  detail: string;
}

const impactLabel = { critical: "Critical impact", high: "High impact", medium: "Medium impact", low: "Low impact" } as const;

/**
 * The single, prioritised finding beside the main chart. Every figure in this
 * panel is computed on the server; the model may explain it but never supplies
 * the numbers or the severity.
 */
export function InsightHero({
  findings,
  range,
  windowLabel,
  context,
  className,
}: {
  findings: Finding[];
  range: string;
  windowLabel: string;
  context: InsightContext[];
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const finding = findings[Math.min(index, findings.length - 1)] ?? null;

  const [explanation, setExplanation] = React.useState<AssistantReply | null>(null);
  const [explainError, setExplainError] = React.useState<string | null>(null);
  const [explaining, setExplaining] = React.useState(false);

  React.useEffect(() => {
    setExplanation(null);
    setExplainError(null);
    setIndex(0);
  }, [range]);

  async function explain(target: Finding) {
    if (explaining) return;
    setExplaining(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page: "overview",
          range,
          question: `Explain this measured finding and what to check next. Do not restate it as certainty. Finding: ${target.title}. Detail: ${target.detail}. Evidence: ${target.evidence.join("; ")}.`,
        }),
      });
      const payload = (await response.json()) as { data: AssistantReply | null; error: { message: string } | null };
      if (!payload.data) {
        setExplainError(payload.error?.message ?? "The analyst did not answer.");
        return;
      }
      setExplanation(payload.data);
    } catch {
      setExplainError("The request did not complete. Try again.");
    } finally {
      setExplaining(false);
    }
  }

  return (
    <section aria-labelledby="insight-heading" className={cn("panel flex min-w-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[7px] border border-accent/30 bg-accent/10">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
          </span>
          <h2 id="insight-heading" className="text-[13px] font-semibold leading-5">
            AI insight
          </h2>
        </div>
        {finding ? (
          <span
            className={cn(
              "rounded-[5px] border px-2 py-0.5 text-[11px] font-medium",
              finding.severity === "critical"
                ? "border-risk-critical/30 bg-risk-critical/10 text-risk-critical"
                : finding.severity === "high"
                  ? "border-risk-medium/30 bg-risk-medium/10 text-risk-medium"
                  : "border-border bg-muted/50 text-muted-foreground",
            )}
          >
            {impactLabel[finding.severity]}
          </span>
        ) : (
          <span className="rounded-[5px] border border-risk-low/30 bg-risk-low/10 px-2 py-0.5 text-[11px] font-medium text-risk-low">
            Inside baseline
          </span>
        )}
      </div>

      {!finding ? (
        <div className="flex flex-1 flex-col gap-3 px-4 py-6">
          <p className="text-[13.5px] font-medium leading-5">Nothing broke away from its trailing baseline</p>
          <p className="text-[11.5px] leading-5 text-muted-foreground">
            Value, payment count, flagged volume and the queue were checked bucket by bucket for the {windowLabel} window.
            A quiet window is reported as quiet — no finding is manufactured to fill this panel.
          </p>
          {context.length > 0 ? <ContextList context={context} /> : null}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
            {findings.length > 1 ? (
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11.5px] font-semibold text-muted-foreground">
                  Priority finding {index + 1} of {findings.length}
                </p>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setIndex((current) => (current - 1 + findings.length) % findings.length)}
                    className="flex size-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Previous finding"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIndex((current) => (current + 1) % findings.length)}
                    className="flex size-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Next finding"
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            <h3 className="text-[14.5px] font-semibold leading-5 tracking-[-0.01em]">{finding.title}</h3>
            <p className="mt-1.5 text-[11.5px] leading-[18px] text-muted-foreground">{finding.detail}</p>

            {finding.metric ? (
              <dl className="mt-3 grid grid-cols-3 divide-x divide-border/60 rounded-tile border border-border/70 bg-background/40">
                <div className="px-2.5 py-2">
                  <dt className="text-[11px] text-muted-foreground">Observed</dt>
                  <dd className="num mt-0.5 text-[12.5px] font-medium">
                    {finding.metric.unit === "usd"
                      ? `$${formatCompactNumber(finding.metric.observed)}`
                      : finding.metric.observed.toLocaleString("en-US")}
                  </dd>
                </div>
                <div className="px-2.5 py-2">
                  <dt className="text-[11px] text-muted-foreground">Baseline</dt>
                  <dd className="num mt-0.5 text-[12.5px] font-medium">
                    {finding.metric.unit === "usd"
                      ? `$${formatCompactNumber(finding.metric.baseline)}`
                      : finding.metric.baseline.toLocaleString("en-US")}
                  </dd>
                </div>
                <div className="px-2.5 py-2">
                  <dt className="text-[11px] text-muted-foreground">Deviation</dt>
                  <dd
                    className={cn(
                      "num mt-0.5 text-[12.5px] font-medium",
                      Math.abs(finding.metric.deviationPct) >= 30 ? "text-risk-medium" : "text-foreground",
                    )}
                  >
                    {finding.metric.deviationPct >= 0 ? "+" : ""}
                    {finding.metric.deviationPct.toFixed(0)}%
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="mt-3.5">
              <p className="text-[11.5px] font-semibold text-muted-foreground">
                Measured context
              </p>
              <ContextList context={context} className="mt-2" />
            </div>

            <div className="mt-3.5 border-t border-border/60 pt-2.5">
              <p className="text-[11.5px] font-semibold text-muted-foreground">Evidence</p>
              <ul className="mt-1.5 space-y-1">
                {finding.evidence.map((line) => (
                  <li key={line} className="flex gap-1.5 text-[11px] leading-4 text-muted-foreground">
                    <span className="mt-[5px] size-1 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
                    <span className="num min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void explain(finding)}
                disabled={explaining}
                className="inline-flex items-center gap-1.5 rounded-[7px] border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-60"
              >
                {explaining ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3" aria-hidden="true" />
                )}
                {explaining ? "Explaining…" : "Explain with AI"}
              </button>
              <Link
                href={finding.href}
                className="inline-flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ScanSearch className="size-3" aria-hidden="true" />
                Supporting records
              </Link>
            </div>

            {explainError ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-tile border border-risk-high/30 bg-risk-high/10 px-2.5 py-2 text-[11px] text-risk-high">
                <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {explainError}
              </p>
            ) : null}

            {explanation ? (
              <div className="mt-2.5 rounded-tile border border-border/70 bg-background/50 px-3 py-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  Model interpretation · figures above are computed
                </p>
                <AnswerBody text={explanation.answer} />
                <EvidenceFooter reply={explanation} />
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 p-3">
            <Link
              href={`/app/analytics?range=${range}`}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-border bg-elevated/50 text-[11.5px] font-medium transition-colors hover:border-border-strong hover:bg-elevated"
            >
              View full analysis
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function ContextList({ context, className }: { context: InsightContext[]; className?: string }) {
  if (context.length === 0) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {context.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[11px] text-foreground/85" title={item.detail}>
              {item.label}
            </span>
            <span className="num shrink-0 text-[11px] font-medium">{item.share.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/70">
            <div
              className="h-full rounded-full"
              style={{
                width: item.share > 0 ? `${Math.min(100, Math.max(1.5, item.share))}%` : 0,
                background: "rgb(var(--accent) / 0.75)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
