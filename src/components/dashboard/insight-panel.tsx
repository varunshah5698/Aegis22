"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Loader2, ScanSearch, Sparkles, TriangleAlert } from "lucide-react";

import { AnswerBody, EvidenceFooter, type AssistantReply } from "@/components/dashboard/analyst-panel";
import { RiskBadge } from "@/components/risk-badge";
import type { Finding } from "@/lib/analytics/findings";
import { cn, formatCompactNumber } from "@/lib/utils";

/**
 * Insight surface.
 *
 * The rows are deterministic findings computed on the server. Selecting one
 * shows the measured figures; asking the model for an explanation sends those
 * same figures back as evidence, so the prose can be checked against the
 * numbers above it.
 */
export function InsightPanel({
  findings,
  windowLabel,
  range,
  className,
}: {
  findings: Finding[];
  windowLabel: string;
  range: string;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState(findings[0]?.id ?? null);
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0];

  const [explanation, setExplanation] = useState<AssistantReply | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  async function explain(finding: Finding) {
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
          question: `Explain this measured finding and what to check next. Do not restate it as certainty. Finding: ${finding.title}. Detail: ${finding.detail}. Evidence: ${finding.evidence.join("; ")}.`,
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
      <div className="panel-head items-center">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[7px] border border-accent/30 bg-accent/10">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
          </span>
          <div>
            <h2 id="insight-heading" className="panel-title">
              Intelligence
            </h2>
            <p className="panel-caption mt-0.5">Measured deviations in the {windowLabel} window</p>
          </div>
        </div>
        <span className="chip border-border/70 text-[11px] text-muted-foreground">{findings.length} findings</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {findings.length === 0 ? (
          <div className="flex flex-1 flex-col items-start gap-3 px-5 py-6">
            <span className="flex size-9 items-center justify-center rounded-full border border-risk-low/25 bg-risk-low/10 text-risk-low">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12.5px] font-medium">Nothing has broken away from its baseline</p>
              <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                Value, payment count, flagged volume and the queue were checked bucket by bucket. A quiet window is
                reported as quiet — no anomaly is manufactured to fill this panel.
              </p>
            </div>
          </div>
        ) : (
          <ul className="max-h-[280px] divide-y divide-border/50 overflow-y-auto">
            {findings.map((finding) => {
              const active = selected?.id === finding.id;
              return (
                <li key={finding.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(finding.id);
                      setExplanation(null);
                      setExplainError(null);
                    }}
                    aria-expanded={active}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors",
                      active ? "bg-muted/30" : "hover:bg-muted/20",
                    )}
                  >
                    <RiskBadge level={finding.severity} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium leading-4">{finding.title}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="num">{finding.period?.label ?? (finding.kind === "backlog" ? "Queue" : "Window")}</span>
                        {finding.metric ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={cn("num", finding.metric.deviationPct >= 0 ? "text-accent" : "text-risk-high")}>
                              {finding.metric.deviationPct >= 0 ? "+" : ""}
                              {finding.metric.deviationPct.toFixed(0)}%
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <ArrowUpRight
                      className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors", active && "text-foreground")}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && findings.length > 0 ? (
          <div className="mt-auto border-t border-border/60 px-4 py-3">
            <p className="text-[11.5px] leading-5 text-muted-foreground">{selected.detail}</p>

            {selected.metric ? (
              <dl className="mt-2.5 grid grid-cols-2 gap-2 rounded-tile border border-border/60 bg-background/40 px-3 py-2">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Observed</dt>
                  <dd className="num mt-0.5 text-[12.5px] font-medium">
                    {selected.metric.unit === "usd"
                      ? `$${formatCompactNumber(selected.metric.observed)}`
                      : selected.metric.observed.toLocaleString("en-US")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Baseline</dt>
                  <dd className="num mt-0.5 text-[12.5px] font-medium">
                    {selected.metric.unit === "usd"
                      ? `$${formatCompactNumber(selected.metric.baseline)}`
                      : selected.metric.baseline.toLocaleString("en-US")}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void explain(selected)}
                disabled={explaining}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-60"
              >
                {explaining ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3" aria-hidden="true" />
                )}
                {explaining ? "Explaining…" : "Explain with analyst"}
              </button>
              <Link
                href={selected.href}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
              <div className="mt-2.5 rounded-tile border border-border/60 bg-background/40 px-3 py-2.5">
                <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                  Model explanation · figures above are computed
                </p>
                <AnswerBody text={explanation.answer} />
                <EvidenceFooter reply={explanation} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
