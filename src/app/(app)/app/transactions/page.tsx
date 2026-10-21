import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, Gauge, ShieldAlert, Wallet } from "lucide-react";

import { MetricRow, MetricTile } from "@/components/app/page-shell";
import { HourBoard } from "@/components/charts/heatmaps";
import {
  ReadoutRail,
  ScoreDistribution,
  ScoredRadar,
} from "@/components/dashboard/overview-panels";
import {
  CorridorLedger,
  StatusSplit,
} from "@/components/dashboard/transaction-graphics";
import { TransactionFeed } from "@/components/dashboard/transaction-feed";
import { RISK_COLORS, SCORE_BANDS, type RiskLevel } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getCorridorSummaries } from "@/lib/data/overview";
import { listTransactions, parseTransactionFilters } from "@/lib/data/transactions";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Transactions" };

const levelLabels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const BAND_ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = q * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return Math.round(a + (b - a) * (position - lower));
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseTransactionFilters(params);
  const { supabase, organization } = await requireOrganization();
  const organizationId = organization!.id;

  const [rows, corridors] = await Promise.all([
    listTransactions(supabase, organizationId, filters),
    getCorridorSummaries(supabase, organizationId, "90d"),
  ]);

  const flagged = rows.filter((row) => row.riskLevel === "high" || row.riskLevel === "critical").length;
  const value = rows.reduce((total, row) => total + row.amountBase, 0);
  const flaggedValue = rows
    .filter((row) => row.riskLevel === "high" || row.riskLevel === "critical")
    .reduce((total, row) => total + row.amountBase, 0);
  const scores = rows.map((row) => Math.round(row.riskScore)).sort((a, b) => a - b);
  const scoreSum = scores.reduce((total, score) => total + score, 0);
  const avgScore = scores.length > 0 ? Math.round((scoreSum / scores.length) * 10) / 10 : 0;
  const medianScore = scores.length > 0 ? scores[Math.floor(scores.length / 2)]! : 0;
  const p90 = quantile(scores, 0.9);
  const aboveThreshold = rows.filter((row) => row.amountBase >= 10_000).length;

  const levels: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const levelValues: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const row of rows) {
    levels[row.riskLevel] += 1;
    levelValues[row.riskLevel] += row.amountBase;
  }
  const mix = BAND_ORDER.map((level) => ({
    level,
    count: levels[level],
    value: Math.round(levelValues[level]),
    share: rows.length > 0 ? (levels[level] / rows.length) * 100 : 0,
  }));

  // Ten-point histogram of the rows in view, same bins the overview uses.
  const distribution = Array.from({ length: 10 }, (_, index) => {
    const low = index * 10;
    const high = low + 9;
    const level: RiskLevel = high < 40 ? "low" : high < 70 ? "medium" : high < 85 ? "high" : "critical";
    return { bin: `${low}-${high}`, low, high, count: 0, level, share: 0 };
  });
  for (const score of scores) {
    const bin = distribution[Math.min(9, Math.floor(score / 10))];
    if (bin) bin.count += 1;
  }
  for (const bin of distribution) {
    bin.share = scores.length > 0 ? (bin.count / scores.length) * 100 : 0;
  }

  // Corridor concentration for the rows in view.
  const corridorMap = new Map<
    string,
    { corridor: string; count: number; value: number; flagged: number; totalScore: number }
  >();
  for (const row of rows) {
    const key = `${row.senderCountry}-${row.receiverCountry}`;
    const entry =
      corridorMap.get(key) ?? { corridor: key, count: 0, value: 0, flagged: 0, totalScore: 0 };
    entry.count += 1;
    entry.value += row.amountBase;
    entry.totalScore += row.riskScore;
    if (row.riskLevel === "high" || row.riskLevel === "critical") entry.flagged += 1;
    corridorMap.set(key, entry);
  }
  const corridorLedger = [...corridorMap.values()]
    .map((entry) => ({
      corridor: entry.corridor,
      count: entry.count,
      value: Math.round(entry.value),
      flagged: entry.flagged,
      averageScore: entry.count > 0 ? Math.round(entry.totalScore / entry.count) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const board = buildBoard(rows);

  const filtersActive =
    filters.risk.length > 0 ||
    Boolean(filters.corridor) ||
    Boolean(filters.status) ||
    filters.minAmount !== null ||
    filters.maxAmount !== null ||
    Boolean(filters.query);

  const highRiskShare = rows.length > 0 ? ((levels.high + levels.critical) / rows.length) * 100 : 0;

  return (
    <div className="workspace-stack mx-auto w-full max-w-[1560px]">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11.5px] font-medium text-muted-foreground">
            <span className="h-px w-5 bg-accent/80" aria-hidden="true" />
            Monitor
          </p>
          <h1 className="app-title mt-2.5">Transactions</h1>
          <p className="app-subtitle">
            Every scored payment in {organization!.name}, newest first. Select a row to open the
            decision, its signals and the corridor context.
          </p>
        </div>
        <div className="toolbar shrink-0">
          <span className="chip">
            <span className="num">{rows.length.toLocaleString("en-US")}</span>{" "}
            {rows.length === 1 ? "payment" : "payments"} in view
          </span>
          <span
            className={cn(
              "chip",
              flagged > 0 && "border-risk-high/30 bg-risk-high/10 text-risk-high",
            )}
          >
            <span className="num">{flagged}</span> high or critical
          </span>
        </div>
      </header>

      {/* Command band: the filtered set's headline value, its composition and
          the readouts an analyst checks before opening a single row. */}
      <section aria-label="Payments in view" className="overview-band">
        <div className="grid gap-0 lg:grid-cols-12">
          <div className="px-6 py-6 lg:col-span-5 lg:px-8 lg:py-8">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[9px] border border-accent/25 bg-accent/10 text-accent">
                <Wallet className="size-4" aria-hidden="true" />
              </span>
              <p className="text-[12.5px] font-medium text-muted-foreground">
                {filtersActive ? "Base value of the filtered set" : "Base value in view"}
              </p>
              <span className="readout-pill">USD</span>
            </div>

            <p className="mt-4 font-display text-[clamp(2.9rem,6vw,4.1rem)] font-bold leading-[0.92] tracking-[-0.05em] text-foreground">
              ${formatCompactNumber(value)}
            </p>

            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
              <span className="num font-medium text-foreground">
                {rows.length.toLocaleString("en-US")}
              </span>{" "}
              payments
              <span aria-hidden="true">·</span>
              <span className="num font-medium text-foreground">
                ${formatCurrency(rows.length > 0 ? value / rows.length : 0, "USD", { maximumFractionDigits: 0 })}
              </span>{" "}
              average
              <span aria-hidden="true">·</span>
              <span className="num font-medium text-foreground">{aboveThreshold}</span> above the
              $10,000 threshold
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="#feed"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[12.5px] font-medium shadow-sm transition-colors hover:border-border-strong hover:bg-muted/60"
              >
                Jump to the feed
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </a>
              <Link
                href="/app/analytics"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[12.5px] font-medium shadow-sm transition-colors hover:border-border-strong hover:bg-muted/60"
              >
                Corridor analytics
              </Link>
            </div>
          </div>

          <div className="px-6 py-6 lg:col-span-4 lg:px-8 lg:py-8 overview-band__split">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12.5px] font-medium text-muted-foreground">Score composition</p>
              <p className="text-[11.5px] text-muted-foreground">
                <span className="num font-medium text-foreground">{medianScore}</span> median ·{" "}
                <span className="num font-medium text-foreground">{p90}</span> p90
              </p>
            </div>
            <div className="mt-4 flex justify-center lg:justify-start">
              <ScoredRadar mix={mix} total={rows.length} />
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
              {mix.map((entry) => (
                <li key={entry.level} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: RISK_COLORS[entry.level] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                    {levelLabels[entry.level]}
                  </span>
                  <span className="num text-[12px] font-medium text-foreground">
                    {entry.count.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 py-6 lg:col-span-3 lg:px-8 lg:py-8 overview-band__split">
            <ReadoutRail
              items={[
                {
                  key: "flagged-value",
                  label: "Flagged value in view",
                  value: `$${formatCompactNumber(flaggedValue)}`,
                  share: value > 0 ? flaggedValue / value : 0,
                  color: "rgb(var(--risk-high))",
                  foot: `${flagged} payments`,
                },
                {
                  key: "flagged-share",
                  label: "High or critical share",
                  value: `${highRiskShare.toFixed(1)}%`,
                  share: highRiskShare / 100,
                  color: "rgb(var(--risk-medium))",
                  foot: `cutoff ${SCORE_BANDS.alert}`,
                },
                {
                  key: "corridors",
                  label: "Corridors in view",
                  value: corridorMap.size,
                  share: Math.min(1, corridorMap.size / Math.max(1, corridors.length || 1)),
                  color: "rgb(var(--chart-1))",
                  foot: `${corridorLedger[0]?.corridor.replace("-", " → ") ?? "—"}`,
                },
              ]}
            />
          </div>
        </div>
      </section>

      <MetricRow>
        <MetricTile
          label="Payments in view"
          value={rows.length.toLocaleString("en-US")}
          icon={Activity}
          hint={`latest ${rows.length} matching the current filters`}
          definition=""
        />
        <MetricTile
          label="Base value"
          value={`$${formatCompactNumber(value)}`}
          icon={Wallet}
          hint={`average ${formatCurrency(rows.length > 0 ? value / rows.length : 0, "USD", { maximumFractionDigits: 0 })} per payment`}
          definition=""
        />
        <MetricTile
          label="High or critical"
          value={flagged.toLocaleString("en-US")}
          icon={ShieldAlert}
          tone={flagged > 0 ? "warning" : "positive"}
          hint={`${highRiskShare.toFixed(1)}% of the rows in view`}
          comparison={`${aboveThreshold} above the $10,000 threshold`}
          definition=""
        />
        <MetricTile
          label="Median score"
          value={medianScore}
          icon={Gauge}
          tone="accent"
          comparison={`average ${avgScore} · p90 ${p90}`}
          hint={`across ${rows.length.toLocaleString("en-US")} scored payments`}
          definition=""
        />
      </MetricRow>

      {/* Statistical band: distribution, corridor concentration, outcomes. */}
      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        <section aria-labelledby="txn-dist-heading" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="txn-dist-heading" className="panel-title text-[14px]">
              Risk score distribution
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Where the rows currently in view sit against the alert cutoff
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <ScoreDistribution
              distribution={distribution}
              avgScore={avgScore}
              medianScore={medianScore}
              p90={p90}
            />
          </div>
        </section>

        <section aria-labelledby="corridor-heading" className="panel flex min-w-0 flex-col xl:col-span-4">
          <div className="px-5 pb-1 pt-5">
            <h2 id="corridor-heading" className="panel-title text-[14px]">
              Corridor concentration
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Top corridors by base value, coloured by average score
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <CorridorLedger items={corridorLedger} />
          </div>
        </section>

        <section aria-labelledby="cadence-heading" className="panel flex min-w-0 flex-col xl:col-span-3">
          <div className="px-5 pb-1 pt-5">
            <h2 id="cadence-heading" className="panel-title text-[14px]">
              Cadence in view
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Payments by weekday and hour, UTC
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-3">
            <HourBoard counts={board.counts} peak={board.peak} />
          </div>
        </section>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        <section aria-labelledby="status-heading" className="panel flex min-w-0 flex-col xl:col-span-5">
          <div className="px-5 pb-1 pt-5">
            <h2 id="status-heading" className="panel-title text-[14px]">
              Settlement outcomes
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              How the rows in view settled, by share of count
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-4">
            <StatusSplit rows={rows} />
          </div>
        </section>

        <section aria-labelledby="band-heading" className="panel flex min-w-0 flex-col xl:col-span-7">
          <div className="px-5 pb-1 pt-5">
            <h2 id="band-heading" className="panel-title text-[14px]">
              Value by risk band
            </h2>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
              Base value carried by each band, with its share of the total in view
            </p>
          </div>
          <div className="min-w-0 flex-1 px-5 pb-5 pt-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {mix.map((entry) => (
                <li key={entry.level} className="rounded-tile border border-border/70 bg-elevated/50 px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span
                        className="size-2 rounded-sm"
                        style={{ background: RISK_COLORS[entry.level] }}
                        aria-hidden="true"
                      />
                      {levelLabels[entry.level]}
                    </span>
                    <span className="num text-[11px] text-muted-foreground">
                      {entry.share.toFixed(1)}%
                    </span>
                  </div>
                  <p className="num mt-1.5 text-[19px] font-semibold leading-6 tracking-[-0.03em]">
                    ${formatCompactNumber(entry.value)}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(entry.value > 0 ? 2 : 0, value > 0 ? (entry.value / value) * 100 : 0)}%`,
                        background: RISK_COLORS[entry.level],
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    <span className="num">{entry.count.toLocaleString("en-US")}</span> payments
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div id="feed">
        <TransactionFeed
          rows={rows}
          filters={filters}
          corridors={corridors.slice(0, 40).map((corridor) => corridor.corridor)}
          matched={rows.length}
        />
      </div>
    </div>
  );
}

/**
 * Weekday × hour board for the rows in view, using the same Sunday = 0
 * indexing the HourBoard labels expect.
 */
function buildBoard(rows: Array<{ createdAt: string }>): {
  counts: number[][];
  peak: { weekday: number; hour: number; count: number } | null;
} {
  const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let peak: { weekday: number; hour: number; count: number } | null = null;

  for (const row of rows) {
    const date = new Date(row.createdAt);
    const weekday = date.getUTCDay();
    const hour = date.getUTCHours();
    const bucket = counts[weekday];
    if (!bucket) continue;
    const next = (bucket[hour] ?? 0) + 1;
    bucket[hour] = next;
    if (!peak || next > peak.count) peak = { weekday, hour, count: next };
  }

  return { counts, peak };
}
