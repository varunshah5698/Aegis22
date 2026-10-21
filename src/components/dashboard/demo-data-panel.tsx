"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  History,
  Loader2,
  Network,
  Sparkles,
} from "lucide-react";

import { generateDemoData, type DemoActionResult } from "@/app/(app)/app/library/demo-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DEMO_PRESETS } from "@/lib/demo/presets";
import { cn } from "@/lib/utils";

/**
 * Demo data studio.
 *
 * Generation is additive by design: rows are inserted with their historical
 * timestamps and scored by the real engine, so the analyst and the baselines
 * see the same shape a real feed would have.
 */
export function DemoDataPanel({
  canGenerate = true,
  welcome = false,
}: {
  canGenerate?: boolean;
  welcome?: boolean;
}) {
  const [presetId, setPresetId] = React.useState(DEMO_PRESETS[1]!.id);
  const [typologies, setTypologies] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<DemoActionResult | null>(null);

  const run = () => {
    setResult(null);
    startTransition(async () => {
      const next = await generateDemoData({ presetId, typologies });
      setResult(next);
    });
  };

  const preset = DEMO_PRESETS.find((entry) => entry.id === presetId) ?? DEMO_PRESETS[1]!;

  return (
    <section
      id="generate"
      aria-labelledby="demo-heading"
      className="panel relative isolate scroll-mt-20 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(var(--accent)/0.14),transparent_58%),radial-gradient(90%_70%_at_100%_100%,rgb(var(--chart-1)/0.1),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(75%_75%_at_30%_20%,black,transparent)]"
      />

      <div className="relative grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="order-2 flex flex-col justify-between border-t border-border/70 p-5 md:p-7 lg:order-1 lg:border-r lg:border-t-0">
          <div>
            <div className="hidden lg:block">
              <p className="inline-flex items-center gap-1.5 rounded-pill border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-[11px] font-medium text-accent">
                <Sparkles className="size-3" aria-hidden="true" />
                {welcome ? "Your workspace is ready" : "Start here"}
              </p>
              <h2
                id="demo-heading"
                className="mt-4 max-w-[15ch] font-display text-[clamp(1.8rem,3vw,2.4rem)] font-semibold leading-[1.03] tracking-[-0.04em]"
              >
                Give the model a past to read.
              </h2>
              <p className="mt-3 max-w-[42ch] text-[13px] leading-6 text-muted-foreground">
                Every signal works backwards from the payment in front of it. Load a history with
                real depth — backdated payments, counterparties, accounts and alerts — and the
                model has something to compare against from the first row.
              </p>
            </div>

            <p className="mb-3 text-[11px] font-medium text-muted-foreground lg:hidden">
              What the run writes
            </p>
            <ol className="mt-0 space-y-3.5 lg:mt-6">
              {[
                {
                  icon: History,
                  title: "Choose how far back to go",
                  body: "One quarter is enough for velocity and 90-day baselines. A year adds seasonality.",
                },
                {
                  icon: Network,
                  title: "Add the patterns worth finding",
                  body: "Structuring, circular flow, pass-through shells and PEP clusters, planted in the noise.",
                },
                {
                  icon: Database,
                  title: "Arrive already scored",
                  body: "The production engine stamps every payment, so the queue and the graph are live.",
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-border/80 bg-card/70 text-muted-foreground">
                    <step.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="num text-[11px] text-muted-foreground/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[12.5px] font-medium">{step.title}</span>
                    </span>
                    <span className="mt-0.5 block max-w-[38ch] text-[11px] leading-4 text-muted-foreground">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-risk-low" aria-hidden="true" />
              Model {preset.days <= 90 ? "needs 90d for full baselines" : "full seasonal history"}
            </span>
            <span aria-hidden="true">·</span>
            <Link
              href="#catalogue-heading"
              className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
            >
              What gets written
            </Link>
          </p>
        </div>

        <div className="order-1 min-w-0 p-5 md:p-7 lg:order-2">
          <div className="mb-5 lg:hidden">
            <p className="inline-flex items-center gap-1.5 rounded-pill border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-[11px] font-medium text-accent">
              <Sparkles className="size-3" aria-hidden="true" />
              {welcome ? "Your workspace is ready" : "Start here"}
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.7rem,6vw,2.1rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              Give the model a past to read.
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              Choose a history depth and generate a backdated, already-scored workspace.
            </p>
          </div>

          <fieldset className="min-w-0">
            <legend className="flex w-full items-baseline justify-between gap-3">
              <span className="text-[12px] font-semibold">History depth</span>
              <span className="num text-[11px] text-muted-foreground">
                {preset.days} days · {preset.payments.toLocaleString("en-US")} payments
              </span>
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DEMO_PRESETS.map((entry) => {
                const active = entry.id === presetId;
                const recommended = entry.id === "quarter";
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPresetId(entry.id)}
                    aria-pressed={active}
                    className={cn(
                      "group relative overflow-hidden rounded-tile border px-3 py-3 text-left transition-[border-color,background-color,transform] duration-200",
                      active
                        ? "border-accent/50 bg-accent/[0.09]"
                        : "border-border/70 bg-elevated/40 hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated",
                    )}
                  >
                    {recommended ? (
                      <span className="absolute right-2 top-2 rounded-pill bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                        Best start
                      </span>
                    ) : null}
                    <span className="block font-display text-[17px] font-semibold leading-5 tracking-[-0.02em]">
                      {entry.label}
                    </span>
                    <span className="num mt-1 block text-[11px] text-muted-foreground">
                      {entry.days}d · {entry.payments.toLocaleString("en-US")} rows
                    </span>
                    <span className="mt-3 flex h-6 items-end gap-[3px]" aria-hidden="true">
                      {[38, 55, 42, 68, 51, 78, 64, 88, 72, 96, 82, 100].map((height, index) => (
                        <span
                          key={index}
                          className={cn(
                            "flex-1 rounded-[1px] transition-colors",
                            active ? "bg-accent/65" : "bg-foreground/15 group-hover:bg-foreground/25",
                          )}
                          style={{ height: `${Math.max(12, height * (entry.days / 365) * 0.55 + 12)}%` }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex items-start gap-2.5 rounded-tile border border-border/60 bg-background/40 px-3 py-2.5">
            <Checkbox
              id="demo-typologies"
              checked={typologies}
              onCheckedChange={(value) => setTypologies(value === true)}
            />
            <div className="min-w-0">
              <Label htmlFor="demo-typologies" className="font-medium">
                Plant typologies to investigate
              </Label>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                Structuring, circular flow, pass-through and PEP clusters. Turn it off for a quiet
                book with ordinary noise only.
              </p>
            </div>
            <span className="ml-auto hidden shrink-0 rounded-pill border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
              4 patterns
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={run}
              disabled={pending || !canGenerate}
              className="group w-full sm:w-auto sm:min-w-[230px]"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {pending ? "Building history…" : "Generate demo dataset"}
              {!pending ? (
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              ) : null}
            </Button>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Writes {preset.payments.toLocaleString("en-US")} payments with {preset.days} days of
              history, scored at insert. About 10 seconds.
            </p>
          </div>

          {!canGenerate ? (
            <p className="mt-3 rounded-tile border border-risk-medium/30 bg-risk-medium/[0.07] px-3 py-2 text-[11px] leading-4 text-muted-foreground">
              Your role can read this workspace but not write to it. Ask an administrator to
              generate the demo dataset, or to change your role to analyst.
            </p>
          ) : null}

          {result ? (
            <div
              role="status"
              className={cn(
                "animate-fade-up mt-4 rounded-tile border px-3.5 py-3 text-[11.5px] leading-5",
                result.ok
                  ? "border-risk-low/30 bg-risk-low/[0.07] text-foreground"
                  : "border-risk-medium/35 bg-risk-medium/[0.08] text-foreground",
              )}
            >
              <p className="flex items-start gap-2 font-medium">
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-risk-low" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-risk-medium" aria-hidden="true" />
                )}
                {result.message}
              </p>
              {result.summary ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {[
                    { label: "Payments", value: result.summary.payments.toLocaleString("en-US") },
                    { label: "Flagged", value: result.summary.flagged.toLocaleString("en-US") },
                    { label: "Entities", value: result.summary.entities.toLocaleString("en-US") },
                    { label: "Alerts", value: result.summary.alerts.toLocaleString("en-US") },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-[11px] text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="num text-[15px] font-medium">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                <Link href="/app/transactions" className="font-medium underline decoration-border underline-offset-2">
                  Open payments
                </Link>
                <Link href="/app/alerts" className="font-medium underline decoration-border underline-offset-2">
                  Review the queue
                </Link>
                <Link href="/app/network" className="font-medium underline decoration-border underline-offset-2">
                  Trace the network
                </Link>
              </p>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-tile border border-border/60 bg-background/40">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <p className="text-[11.5px] font-semibold text-muted-foreground">
                What lands in the queue
              </p>
              <span className="text-[11px] text-muted-foreground/70">illustrative</span>
            </div>
            <ul className="divide-y divide-border/50">
              {[
                { route: "SG → HK", detail: "7 × $9,400 · under threshold", score: 91, tone: "high" },
                { route: "GB → AE", detail: "$48,200 · first corridor", score: 88, tone: "high" },
                { route: "DE → NG", detail: "$212,400 · returned in 61h", score: 74, tone: "medium" },
              ].map((row) => (
                <li key={row.route} className="flex items-center gap-3 px-3 py-2">
                  <span className="num w-[54px] shrink-0 text-[11px] text-foreground">{row.route}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {row.detail}
                  </span>
                  <span
                    className={cn(
                      "num rounded-pill px-1.5 py-0.5 text-[11px] font-medium",
                      row.tone === "high"
                        ? "bg-risk-high/[0.12] text-risk-high"
                        : "bg-risk-medium/[0.12] text-risk-medium",
                    )}
                  >
                    {row.score}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border/60 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
              Backdated, scored at insert and labelled{" "}
              <span className="num text-foreground">DEMO-</span> so generated history stays
              distinguishable from your own feed.
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            Additive, not a reset. Limited to three runs per ten minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
