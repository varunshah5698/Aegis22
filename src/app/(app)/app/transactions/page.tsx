import type { Metadata } from "next";

import { MetricTile, PageSection, PageShell } from "@/components/app/page-shell";
import { TransactionFeed } from "@/components/dashboard/transaction-feed";
import { RISK_COLORS, type RiskLevel } from "@/config/risk";
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
  const scores = rows.map((row) => Math.round(row.riskScore)).sort((a, b) => a - b);
  const medianScore = scores.length > 0 ? scores[Math.floor(scores.length / 2)]! : 0;
  const levels: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const row of rows) levels[row.riskLevel] += 1;
  const corridorCount = new Set(rows.map((row) => `${row.senderCountry}-${row.receiverCountry}`)).size;

  return (
    <PageShell
      eyebrow="Monitor"
      title="Transactions"
      description={`Every scored payment in ${organization!.name}, newest first. Select a row to open the decision, its signals and the corridor context.`}
      meta={
        <>
          <span className="chip">
            <span className="num">{rows.length.toLocaleString("en-US")}</span>{" "}
            {rows.length === 1 ? "payment" : "payments"} in view
          </span>
          <span className="chip">
            <span className="num">{corridorCount}</span> {corridorCount === 1 ? "corridor" : "corridors"}
          </span>
          <span className={cn("chip", flagged > 0 && "border-risk-high/30 bg-risk-high/10 text-risk-high")}>
            <span className="num">{flagged}</span> high or critical
          </span>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Payments in view"
          value={rows.length.toLocaleString("en-US")}
          hint={`latest ${rows.length} matching the current filters`}
        />
        <MetricTile
          label="Base value"
          value={`$${formatCompactNumber(value)}`}
          hint={`average ${formatCurrency(value / Math.max(1, rows.length), "USD", { maximumFractionDigits: 0 })} per payment`}
        />
        <MetricTile
          label="High or critical"
          value={flagged.toLocaleString("en-US")}
          tone={flagged > 0 ? "warning" : "positive"}
          hint={`${((flagged / Math.max(1, rows.length)) * 100).toFixed(1)}% of the rows in view`}
        />
        <MetricTile
          label="Median score"
          value={medianScore}
          tone="accent"
          hint={`across ${rows.length.toLocaleString("en-US")} scored payments`}
        />
      </div>

      <PageSection
        id="risk-mix-heading"
        title="Risk mix in view"
        description="How the rows currently on screen split across the model's risk bands"
        bodyClassName="px-5 py-4"
      >
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Risk level split for the rows in view">
          {(Object.keys(levels) as RiskLevel[]).map((level) =>
            levels[level] > 0 ? (
              <span
                key={level}
                style={{
                  width: `${(levels[level] / Math.max(1, rows.length)) * 100}%`,
                  background: RISK_COLORS[level],
                }}
                title={`${levelLabels[level]}: ${levels[level]}`}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-4">
          {(Object.keys(levels) as RiskLevel[]).map((level) => (
            <li key={level} className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-sm" style={{ background: RISK_COLORS[level] }} aria-hidden="true" />
              <span className="flex-1 text-[12px] text-muted-foreground">{levelLabels[level]}</span>
              <span className="num text-[12.5px] font-medium">{levels[level].toLocaleString("en-US")}</span>
              <span className="num w-12 text-right text-[11px] text-muted-foreground">
                {((levels[level] / Math.max(1, rows.length)) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </PageSection>

      <TransactionFeed
        rows={rows}
        filters={filters}
        corridors={corridors.slice(0, 40).map((corridor) => corridor.corridor)}
        matched={rows.length}
      />
    </PageShell>
  );
}
