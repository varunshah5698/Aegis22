import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Cpu, Database, Lock } from "lucide-react";

import { PageSection } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { AnalystConsole, type ConsoleEvidence } from "@/components/dashboard/analyst-console";
import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai/river";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange, rangeOptions } from "@/lib/data/common";

export const metadata: Metadata = { title: "AI analyst" };

const steps = [
  "The server resolves your organisation and the window in the URL — never a client-supplied id.",
  "Aggregates for that window are read from the database: totals, corridors, bands, signals, payers and the queue.",
  "Those figures are serialised with a legend and sent to the model as the only permitted evidence.",
  "The answer returns with the window and figures it used, printed beneath the reply.",
];

const boundaries = [
  "It cannot see other organisations, live market data or future activity.",
  "Flagged activity is risk, not proof: replies are instructed not to allege wrongdoing.",
  "It cannot execute payments, close alerts or change rules — it explains and recommends only.",
  "Every reply is a model interpretation of computed figures; the figures are the audit trail.",
];

export default async function AnalystPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, organization } = await requireOrganization();
  const config = getAiConfig();
  const analytics = await getWorkspaceAnalytics(supabase, organization!.id, range);

  const evidence: ConsoleEvidence = {
    windowLabel: rangeLabel,
    from: analytics.window.from,
    to: analytics.window.to,
    payments: analytics.totals.count,
    valueUsd: analytics.totals.value,
    flagged: analytics.totals.flagged,
    avgScore: analytics.totals.avgScore,
    cutoff: SCORE_BANDS.alert,
    modelVersion: MODEL_VERSION,
    model: config.model,
    configured: config.configured,
    corridors: analytics.corridors.slice(0, 4).map((corridor) => ({
      corridor: corridor.corridor,
      count: corridor.count,
      value: corridor.value,
      flagged: corridor.flagged,
    })),
    signals: analytics.signals.slice(0, 4).map((signal) => ({ label: signal.label, count: signal.count })),
  };

  return (
    <div className="workspace-stack">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="label-xs">Intelligence / Analysis</p>
          <span className="chip">workspace {organization!.name}</span>
        </div>
        <RangeTabs basePath="/app/analyst" current={range} />
      </header>

      <AnalystConsole range={range} evidence={evidence} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PageSection
          id="grounding-heading"
          title="How answers are built"
          description="A fixed pipeline, in this order"
          className="lg:col-span-1"
        >
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-[10px] font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <span className="text-[11.5px] leading-5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection
          id="boundaries-heading"
          title="Hard boundaries"
          description="What the analyst is instructed never to do"
          className="lg:col-span-1"
        >
          <ul className="space-y-2.5">
            {boundaries.map((line) => (
              <li key={line} className="flex gap-2 text-[11.5px] leading-5 text-muted-foreground">
                <Lock className="mt-1 size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection
          id="provider-heading"
          title="Provider"
          description="Server-side only; credentials never reach the browser"
          className="lg:col-span-1"
        >
          <dl className="space-y-2.5 text-[11.5px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3" aria-hidden="true" /> Model
              </dt>
              <dd className="num text-right text-foreground">{config.model}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Database className="size-3" aria-hidden="true" /> Evidence
              </dt>
              <dd className="text-right text-foreground">Workspace aggregates</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">Endpoint</dt>
              <dd className="num truncate text-right text-foreground">{config.baseUrl.replace(/^https?:\/\//, "")}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            <Link
              href="/app/analytics?range=90d"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Open analytics <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
            <Link
              href="/app/alerts"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Open queue <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </PageSection>
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        The analyst is an explanatory layer over computed figures, not a compliance determination. Investigators remain
        accountable for every decision, and the evidence footer on each reply is the record of what the model actually
        saw.
      </p>
    </div>
  );
}
