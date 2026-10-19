import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";

import { PageSection, PageShell, SectionLink } from "@/components/app/page-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MODEL_VERSION, SCORE_BANDS, supportedCurrencies } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getFxProviderConfig } from "@/lib/fx/provider";
import { getAiConfig } from "@/lib/ai/river";
import { readServerSupabaseConfig } from "@/lib/supabase/public-config";
import { cn, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Data library" };

const SAMPLE_CAP = 20_000;

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function freshness(iso: string | null): { label: string; tone: "ok" | "warn" } {
  if (!iso) return { label: "No rows yet", tone: "warn" };
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 90) return { label: `${minutes}m ago`, tone: "ok" };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { label: `${hours}h ago`, tone: hours < 24 ? "ok" : "warn" };
  return { label: `${Math.round(hours / 24)}d ago`, tone: "warn" };
}

export default async function DataLibraryPage() {
  const { supabase, organization } = await requireOrganization();
  const organizationId = organization!.id;

  const PAGE = 1_000;
  const samplePromise = (async () => {
    const collected: Array<{
      external_id: string;
      created_at: string;
      sender_country: string;
      receiver_country: string;
      amount: number;
      currency: string;
      amount_base: number;
      risk_score: number | null;
      risk_level: string | null;
      status: string;
    }> = [];
    for (let offset = 0; offset < SAMPLE_CAP; offset += PAGE) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "external_id, created_at, sender_country, receiver_country, amount, currency, amount_base, risk_score, risk_level, status",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(offset, Math.min(offset + PAGE, SAMPLE_CAP) - 1);
      if (error) throw new Error(error.message);
      collected.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return collected;
  })();

  const [countResults, rows] = await Promise.all([
    Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("entities").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("cases").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("rules").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    ]),
    samplePromise,
  ]);

  for (const result of countResults) {
    if (result.error) throw new Error(result.error.message);
  }

  const [transactions, entities, accounts, alerts, cases, rules, reports] = countResults;
  const generatedAt = new Date().toISOString();

  const latest = rows[0]?.created_at ?? null;
  const ingest = freshness(latest);

  const missingScore = rows.filter((row) => row.risk_score === null).length;
  const missingBase = rows.filter((row) => !row.amount_base || Number(row.amount_base) <= 0).length;
  const missingCorridor = rows.filter((row) => !row.sender_country || !row.receiver_country).length;
  const unknownCurrency = rows.filter((row) => !supportedCurrencies.includes(row.currency)).length;
  const duplicateIds = (() => {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of rows) {
      if (seen.has(row.external_id)) duplicates += 1;
      else seen.add(row.external_id);
    }
    return duplicates;
  })();
  const distinctCorridors = new Set(rows.map((row) => `${row.sender_country}-${row.receiver_country}`)).size;

  const checks = [
    {
      id: "score",
      label: "Risk score present",
      value: rows.length ? `${percent(rows.length - missingScore, rows.length).toFixed(2)}%` : "—",
      ok: missingScore === 0,
      detail: missingScore === 0 ? "Every sampled payment carries a score." : `${missingScore.toLocaleString("en-US")} rows have no score.`,
    },
    {
      id: "base",
      label: "USD base amount present",
      value: rows.length ? `${percent(rows.length - missingBase, rows.length).toFixed(2)}%` : "—",
      ok: missingBase === 0,
      detail:
        missingBase === 0
          ? "All sampled rows converted at ingestion."
          : `${missingBase.toLocaleString("en-US")} rows are missing a positive amount_base.`,
    },
    {
      id: "corridor",
      label: "Corridor countries present",
      value: rows.length ? `${percent(rows.length - missingCorridor, rows.length).toFixed(2)}%` : "—",
      ok: missingCorridor === 0,
      detail:
        missingCorridor === 0
          ? `${distinctCorridors} distinct corridors in the sample.`
          : `${missingCorridor.toLocaleString("en-US")} rows lack a sender or receiver country.`,
    },
    {
      id: "currency",
      label: "Currency in the supported set",
      value: rows.length ? `${percent(rows.length - unknownCurrency, rows.length).toFixed(2)}%` : "—",
      ok: unknownCurrency === 0,
      detail:
        unknownCurrency === 0
          ? `${supportedCurrencies.length} currencies supported by the model.`
          : `${unknownCurrency.toLocaleString("en-US")} rows use a currency outside the scoring set.`,
    },
    {
      id: "duplicates",
      label: "External identifiers unique",
      value: rows.length ? `${(rows.length - duplicateIds).toLocaleString("en-US")}/${rows.length.toLocaleString("en-US")}` : "—",
      ok: duplicateIds === 0,
      detail: duplicateIds === 0 ? "No duplicate external ids in the newest sample." : `${duplicateIds} repeated external ids.`,
    },
  ];

  const fields = [
    { name: "external_id", type: "text", note: "Sender-assigned payment reference; unique per organisation.", filled: rows.filter((row) => row.external_id).length },
    { name: "created_at", type: "timestamptz", note: "Arrival time in UTC. Every window and bucket is derived from it.", filled: rows.filter((row) => row.created_at).length },
    { name: "sender_country", type: "char(2)", note: "ISO 3166-1 alpha-2 origin used for corridor risk.", filled: rows.filter((row) => row.sender_country).length },
    { name: "receiver_country", type: "char(2)", note: "ISO 3166-1 alpha-2 destination used for corridor risk.", filled: rows.filter((row) => row.receiver_country).length },
    { name: "amount", type: "numeric", note: "Original settlement amount in `currency`.", filled: rows.filter((row) => row.amount !== null).length },
    { name: "currency", type: "char(3)", note: "Settlement currency; converted to USD at ingestion.", filled: rows.filter((row) => row.currency).length },
    { name: "amount_base", type: "numeric", note: "USD base value used by every aggregate on the dashboard.", filled: rows.length - missingBase },
    { name: "risk_score", type: "integer 0-100", note: `Stamped by model ${MODEL_VERSION}; cutoff ${SCORE_BANDS.alert}.`, filled: rows.length - missingScore },
    { name: "risk_level", type: "enum", note: "Derived band: low, medium, high, critical.", filled: rows.filter((row) => row.risk_level).length },
    { name: "status", type: "enum", note: "Settlement state recorded with the payment.", filled: rows.filter((row) => row.status).length },
  ];

  const fx = getFxProviderConfig();
  const ai = getAiConfig();
  const supabaseHost = readServerSupabaseConfig()
    .url.replace(/^https?:\/\//, "")
    .split("/")[0];

  const catalogue = [
    { table: "transactions", rows: transactions.count ?? 0, purpose: "Scored payments and their base value", href: "/app/transactions" },
    { table: "entities", rows: entities.count ?? 0, purpose: "Counterparties, ownership and PEP flags", href: "/app/network" },
    { table: "accounts", rows: accounts.count ?? 0, purpose: "Accounts linking entities to payments", href: "/app/network" },
    { table: "alerts", rows: alerts.count ?? 0, purpose: "Rule and model detections with SLA state", href: "/app/alerts" },
    { table: "cases", rows: cases.count ?? 0, purpose: "Investigations opened from alerts", href: "/app/cases" },
    { table: "rules", rows: rules.count ?? 0, purpose: "Versioned deterministic checks", href: "/app/rules" },
    { table: "reports", rows: reports.count ?? 0, purpose: "Generated regulator-ready exports", href: "/app/reports" },
  ];

  return (
    <PageShell
      eyebrow="Intelligence / Data"
      title="Data library"
      description={`The tables behind ${organization!.name}, what they contain and how complete they are. Every figure below is read live from the workspace database.`}
      meta={
        <>
          <span className="chip">
            <span className="num">{(transactions.count ?? 0).toLocaleString("en-US")}</span> payments
          </span>
          <span className="chip">
            last write <span className="num">{ingest.label}</span>
          </span>
          <span className="chip">
            model {MODEL_VERSION} · cutoff {SCORE_BANDS.alert}
          </span>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Scored payments"
          value={(transactions.count ?? 0).toLocaleString("en-US")}
          icon={Database}
          comparison={`${distinctCorridors} corridors in the newest ${formatCompactNumber(rows.length)}`}
          definition="Rows in the transactions table for this workspace, enforced by row-level security."
        />
        <KpiCard
          label="Entities & accounts"
          value={`${(entities.count ?? 0).toLocaleString("en-US")} / ${(accounts.count ?? 0).toLocaleString("en-US")}`}
          icon={ClipboardList}
          comparison="counterparties / accounts"
          definition="Entities are the legal or natural counterparties; accounts link them to payments and power the network graph."
        />
        <KpiCard
          label="Alerts & cases"
          value={`${(alerts.count ?? 0).toLocaleString("en-US")} / ${(cases.count ?? 0).toLocaleString("en-US")}`}
          icon={AlertTriangle}
          tone={(alerts.count ?? 0) > 0 ? "warning" : "default"}
          comparison="detections / investigations"
          definition="Alerts are raised automatically at or above the cutoff; cases are analyst investigations opened from them."
        />
        <KpiCard
          label="Ingestion freshness"
          value={ingest.label}
          icon={RefreshCw}
          tone={ingest.tone === "ok" ? "positive" : "warning"}
          comparison={latest ? `latest row ${new Date(latest).toISOString().slice(0, 16).replace("T", " ")}Z` : "waiting for rows"}
          definition="Age of the newest transaction row. A stale value means ingestion has stopped, not that the book is quiet."
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="catalogue-heading"
          className="xl:col-span-8"
          title="Dataset catalogue"
          description="Tables in this workspace with live row counts and the page that reads them"
          action={<SectionLink href="/docs/api">Ingestion API</SectionLink>}
          flush
        >
          <div className="overflow-x-auto">
            <table className="table-base min-w-[560px]">
              <caption className="sr-only">Workspace tables, row counts and destinations</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5">Table</th>
                  <th scope="col">Contains</th>
                  <th scope="col" className="text-right">Rows</th>
                  <th scope="col" className="pr-5 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.map((entry) => (
                  <tr key={entry.table}>
                    <th scope="row" className="num pl-5 text-left font-normal">{entry.table}</th>
                    <td className="text-muted-foreground">{entry.purpose}</td>
                    <td className="num text-right">{entry.rows.toLocaleString("en-US")}</td>
                    <td className="pr-5 text-right">
                      <Link
                        href={entry.href}
                        className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
            Counts are read with the signed-in analyst&apos;s session, so row-level security applies. Nothing is cached
            beyond this request.
          </p>
        </PageSection>

        <PageSection
          id="exports-heading"
          className="xl:col-span-4"
          title="Exports and ingestion"
          description="Real downloads generated from this workspace"
        >
          <div className="space-y-2">
            <a
              href="/api/export/transactions?range=90d"
              className="flex items-center gap-2.5 rounded-tile border border-border/70 bg-elevated/50 px-3 py-2.5 text-[12px] transition-colors hover:border-border-strong hover:bg-elevated"
            >
              <ArrowDownToLine className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Payments, last 90 days</span>
                <span className="block text-[10.5px] text-muted-foreground">CSV · 12 columns · up to 50,000 rows</span>
              </span>
            </a>
            <a
              href="/api/export/transactions?range=24h"
              className="flex items-center gap-2.5 rounded-tile border border-border/70 bg-elevated/50 px-3 py-2.5 text-[12px] transition-colors hover:border-border-strong hover:bg-elevated"
            >
              <ArrowDownToLine className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Payments, last 24 hours</span>
                <span className="block text-[10.5px] text-muted-foreground">CSV · same schema · newest first</span>
              </span>
            </a>
            <a
              href="/api/export/template"
              className="flex items-center gap-2.5 rounded-tile border border-border/70 bg-elevated/50 px-3 py-2.5 text-[12px] transition-colors hover:border-border-strong hover:bg-elevated"
            >
              <FileSpreadsheet className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Ingestion template</span>
                <span className="block text-[10.5px] text-muted-foreground">CSV header and one example row</span>
              </span>
            </a>
          </div>

          <div className="mt-4 rounded-tile border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Why there is no upload button</p>
            <p className="mt-1">
              Payments enter through the authenticated ingestion endpoint so scoring, entity resolution and the audit log
              always apply. Dropping a CSV straight into the table would bypass all three. Export the template, then post
              it with your workspace key — the{" "}
              <Link href="/docs/api" className="font-medium text-foreground underline decoration-border underline-offset-2">
                API guide
              </Link>{" "}
              documents the payload.
            </p>
          </div>
        </PageSection>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <PageSection
          id="fields-heading"
          className="xl:col-span-7"
          title="Field profile"
          description={`Completeness measured on the newest ${rows.length.toLocaleString("en-US")} payments`}
          flush
        >
          <div className="overflow-x-auto">
            <table className="table-base min-w-[560px]">
              <caption className="sr-only">Transaction fields, types and completeness</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5">Field</th>
                  <th scope="col">Type</th>
                  <th scope="col">Contract</th>
                  <th scope="col" className="pr-5 text-right">Filled</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const share = percent(field.filled, rows.length);
                  return (
                    <tr key={field.name}>
                      <th scope="row" className="num pl-5 text-left font-normal">{field.name}</th>
                      <td className="num text-[11px] text-muted-foreground">{field.type}</td>
                      <td className="text-[11px] text-muted-foreground">{field.note}</td>
                      <td className="pr-5 text-right">
                        <span
                          className={cn(
                            "num text-[11.5px]",
                            share >= 99.5 ? "text-foreground" : share > 0 ? "text-risk-medium" : "text-risk-critical",
                          )}
                        >
                          {rows.length ? `${share.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection
          id="quality-heading"
          className="xl:col-span-5"
          title="Quality checks"
          description="Five checks run against the same sample; failures are stated, not smoothed over"
        >
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    check.ok
                      ? "border-risk-low/30 bg-risk-low/10 text-risk-low"
                      : "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
                  )}
                >
                  {check.ok ? (
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-3" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium">{check.label}</span>
                    <span className="num text-[11.5px] text-muted-foreground">{check.value}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{check.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border/60 pt-3 text-[10.5px] leading-4 text-muted-foreground">
            Sample capped at {SAMPLE_CAP.toLocaleString("en-US")} newest rows. Checks describe this workspace only; they
            are not a substitute for a warehouse-level data quality programme.
          </p>
        </PageSection>
      </div>

      <PageSection
        id="sources-heading"
        title="Connected sources"
        description="What this deployment actually talks to, and whether each integration is configured"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Database",
              value: supabaseHost || "not set",
              detail: "Supabase Postgres with row-level security per organisation.",
              ok: Boolean(supabaseHost),
            },
            {
              label: "FX provider",
              value: fx.source.label,
              detail: fx.source.delayed ? "Published fixing, not a live quote." : "Streaming quotes.",
              ok: fx.id === "frankfurter",
            },
            {
              label: "AI analyst",
              value: ai.model,
              detail: ai.configured ? "Server-side key configured; evidence is workspace-scoped." : "RIVER_API_KEY is not set.",
              ok: ai.configured,
            },
            {
              label: "Scoring model",
              value: MODEL_VERSION,
              detail: `Alert cutoff ${SCORE_BANDS.alert}. Stamped on every scored payment.`,
              ok: true,
            },
          ].map((source) => (
            <div key={source.label} className="rounded-tile border border-border/70 bg-elevated/40 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="label-xs">{source.label}</p>
                <span
                  className={cn("size-2 rounded-full", source.ok ? "bg-risk-low" : "bg-risk-medium")}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 truncate text-[12px] font-medium" title={source.value}>
                {source.value}
              </p>
              <p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">{source.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[10.5px] text-muted-foreground">
          <span>
            Snapshot generated <span className="num">{generatedAt.slice(0, 19).replace("T", " ")}Z</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>No third-party analytics receive payment data.</span>
        </p>
      </PageSection>
    </PageShell>
  );
}
