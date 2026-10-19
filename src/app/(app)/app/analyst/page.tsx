import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Cpu, Database, Lock, Sparkles } from "lucide-react";

import { PageSection, PageShell } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { AnalystPanel } from "@/components/dashboard/analyst-panel";
import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai/river";
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
  const { organization } = await requireOrganization();
  const config = getAiConfig();

  return (
    <PageShell
      eyebrow="Intelligence / Analysis"
      title="AI analyst"
      description="Ask questions about the selected window. The analyst reads the same aggregates the dashboard renders, states the window it used, and separates measurement from interpretation."
      actions={<RangeTabs basePath="/app/analyst" current={range} />}
      meta={
        <>
          <span className="chip">
            workspace {organization!.name}
          </span>
          <span className="chip">
            window {rangeLabel} · model {MODEL_VERSION} · cutoff {SCORE_BANDS.alert}
          </span>
          <span className="chip">
            {config.configured ? (
              <>
                <CheckCircle2 className="size-3 text-risk-low" aria-hidden="true" />
                provider configured
              </>
            ) : (
              <>
                <AlertTriangle className="size-3 text-risk-medium" aria-hidden="true" />
                provider not configured
              </>
            )}
          </span>
        </>
      }
    >
      {!config.configured ? (
        <div className="flex items-start gap-3 rounded-tile border border-risk-medium/40 bg-risk-medium/10 px-4 py-3 text-[12.5px] leading-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk-medium" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">The model provider is not configured for this deployment</p>
            <p className="mt-1 text-muted-foreground">
              Set <span className="num">RIVER_API_KEY</span> in the server environment. Until then the analyst returns a
              clear configuration error rather than a fabricated answer.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <AnalystPanel
          range={range}
          page="analyst"
          className="xl:col-span-8"
          scrollAreaClassName="max-h-[520px] min-h-[240px]"
        />

        <div className="space-y-4 xl:col-span-4">
          <PageSection
            id="grounding-heading"
            title="How answers are built"
            description="A fixed pipeline, in this order"
            bodyClassName="px-5 py-4"
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
            bodyClassName="px-5 py-4"
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
            bodyClassName="px-5 py-4"
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
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-3" aria-hidden="true" /> Endpoint
                </dt>
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
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        The analyst is an explanatory layer over computed figures, not a compliance determination. Investigators remain
        accountable for every decision, and the evidence footer on each reply is the record of what the model actually saw.
      </p>
    </PageShell>
  );
}
