import type { Metadata } from "next";
import Link from "next/link";

import { MetricTile, PageSection, PageShell, Sparkline } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { CorridorHeatGrid } from "@/components/charts/heatmaps";
import { CorridorMatrix } from "@/components/charts/corridor-matrix";
import { RISK_COLORS } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { cn, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Corridors" };

export default async function CorridorsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range, "90d");
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, organization } = await requireOrganization();
  const analytics = await getWorkspaceAnalytics(supabase, organization!.id, range);

  const { corridors } = analytics;
  const flagged = corridors.reduce((total, corridor) => total + corridor.flagged, 0);
  const riskiest = corridors.reduce(
    (worst, corridor) => (corridor.avgScore > (worst?.avgScore ?? -1) ? corridor : worst),
    corridors[0],
  );
  const busiest = corridors[0];

  return (
    <PageShell
      eyebrow="Monitor / Geographies"
      title="Corridors"
      description={`Average risk, volume and exposure for every sender-to-receiver pair over the last ${rangeLabel}. Select any cell to open the matching payments.`}
      actions={<RangeTabs basePath="/app/corridors" current={range} />}
      meta={
        <>
          <span className="chip">
            <span className="num">{corridors.length}</span> active corridors
          </span>
          <span className="chip">
            <span className="num">{formatCompactNumber(analytics.totals.value)}</span> USD screened
          </span>
          <span className={cn("chip", flagged > 0 && "border-risk-high/30 bg-risk-high/10 text-risk-high")}>
            <span className="num">{flagged}</span> flagged
          </span>
          {riskiest ? (
            <span className="chip">
              riskiest <span className="num">{riskiest.corridor}</span> · {riskiest.avgScore}
            </span>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Corridors in window"
          value={corridors.length.toLocaleString("en-US")}
          hint={`across ${formatCompactNumber(analytics.totals.counterparties)} counterparties`}
        />
        <MetricTile
          label="Busiest corridor"
          value={busiest ? busiest.corridor : "—"}
          hint={busiest ? `${formatCompactNumber(busiest.value)} USD · ${busiest.count} payments` : undefined}
        />
        <MetricTile
          label="Highest average score"
          value={riskiest ? riskiest.avgScore : "—"}
          tone={riskiest && riskiest.avgScore >= 40 ? "warning" : "default"}
          hint={riskiest ? `${riskiest.corridor} · peak ${riskiest.peakScore}` : undefined}
        />
        <MetricTile
          label="Flagged payments"
          value={flagged.toLocaleString("en-US")}
          tone={flagged > 0 ? "warning" : "positive"}
          hint={`${analytics.totals.flaggedShare.toFixed(2)}% of all payments in window`}
        />
      </div>

      <PageSection
        id="matrix-heading"
        title="Sender and receiver risk map"
        description="Average score per country pair over the selected window, with the screened value beneath"
      >
        <CorridorMatrix
          corridors={corridors.map((corridor) => ({
            corridor: corridor.corridor,
            senderCountry: corridor.senderCountry,
            receiverCountry: corridor.receiverCountry,
            count: corridor.count,
            value: corridor.value,
            flagged: corridor.flagged,
            averageScore: corridor.avgScore,
          }))}
        />
      </PageSection>

      <PageSection
        id="exposure-heading"
        title="Corridor exposure over time"
        description="Average score per period for the eight corridors carrying the most value"
      >
        <CorridorHeatGrid matrix={analytics.matrix} />
      </PageSection>

      <PageSection
        id="corridor-table-heading"
        title="Corridor performance"
        description="Ranked by screened value, with the flagged share and the number of payments"
        flush
      >
        <div className="overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <caption className="sr-only">Corridor volume, risk and exposure</caption>
            <thead className="sticky top-0">
              <tr>
                <th scope="col" className="pl-5">Corridor</th>
                <th scope="col" className="text-right">Payments</th>
                <th scope="col" className="text-right">Value (USD)</th>
                <th scope="col" className="text-right">Share</th>
                <th scope="col" className="text-right">Flagged</th>
                <th scope="col">Average score</th>
                <th scope="col" className="pr-5 text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {corridors.slice(0, 25).map((corridor) => {
                const level =
                  corridor.avgScore >= 85
                    ? "critical"
                    : corridor.avgScore >= 70
                      ? "high"
                      : corridor.avgScore >= 40
                        ? "medium"
                        : "low";
                return (
                  <tr key={corridor.corridor}>
                    <th scope="row" className="pl-5 text-left font-normal">
                      <Link href={`/app/transactions?corridor=${corridor.corridor}`} className="num hover:underline">
                        {corridor.corridor}
                      </Link>
                    </th>
                    <td className="num text-right">{corridor.count.toLocaleString("en-US")}</td>
                    <td className="num text-right">{formatCompactNumber(corridor.value)}</td>
                    <td className="num text-right text-muted-foreground">{corridor.share.toFixed(1)}%</td>
                    <td className={cn("num text-right", corridor.flagged > 0 && "text-risk-high")}>{corridor.flagged}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, corridor.avgScore)}%`, background: RISK_COLORS[level] }}
                          />
                        </span>
                        <span className="num text-[12px]">{corridor.avgScore}</span>
                      </span>
                    </td>
                    <td className="pr-5">
                      <span className="flex justify-end text-accent/70">
                        <Sparkline values={corridor.spark} className="h-5 w-16" fill={false} strokeWidth={1.4} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
