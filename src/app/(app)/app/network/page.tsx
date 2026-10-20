import type { Metadata } from "next";
import Link from "next/link";

import { PageSection, PageShell, StatStrip } from "@/components/app/page-shell";
import { RangeTabs } from "@/components/app/range-tabs";
import { NetworkGraph } from "@/components/dashboard/network-graph";
import { EmptyState } from "@/components/states";
import { requireOrganization } from "@/lib/auth";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { describeNetworkFlags, getNetworkGraph } from "@/lib/data/network";
import { cn, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Network" };

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range, "90d");
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, organization } = await requireOrganization();
  const graph = await getNetworkGraph(supabase, organization!.id, range);
  const flags = describeNetworkFlags(graph.nodes);
  const criticalFlags = flags.filter((flag) => flag.severity === "critical").length;

  return (
    <PageShell
      eyebrow="Investigate / Entities"
      title="Network"
      description={`Who pays whom over the last ${rangeLabel}. Pass-through intermediaries and high-risk exposure surface without reading a single row.`}
      actions={<RangeTabs basePath="/app/network" current={range} />}
      meta={
        <>
          <span className="num">{graph.stats.entities} entities</span>
          <span className="num">{graph.stats.transfers.toLocaleString("en-US")} transfers</span>
          <span className="num">{formatCompactNumber(graph.stats.value)} USD</span>
          <span className={cn(criticalFlags > 0 ? "text-risk-critical" : undefined)}>
            {flags.length} structural flags{criticalFlags > 0 ? ` · ${criticalFlags} critical` : ""}
          </span>
        </>
      }
    >
      <StatStrip
        items={[
          { label: "Entities in view", value: graph.stats.entities.toLocaleString("en-US"), hint: `last ${rangeLabel}` },
          {
            label: "Transfers mapped",
            value: graph.stats.transfers.toLocaleString("en-US"),
            hint: "linked sender → receiver",
          },
          { label: "Value routed (USD)", value: formatCompactNumber(graph.stats.value), hint: "base currency" },
          {
            label: "Average score",
            value: graph.stats.averageScore,
            hint: "across mapped entities",
            tone: graph.stats.averageScore >= 40 ? "warning" : "default",
          },
        ]}
      />

      <PageSection
        id="graph-heading"
        title="Relationship explorer"
        description="Every bead is an entity and every curve a real transfer. Bead size tracks screened value, the halo tracks risk; hover to light up a counterparty's flows and switch layouts without losing your filters."
        flush={false}
        bodyClassName="px-4 py-4"
      >
        {graph.nodes.length === 0 ? (
          <EmptyState
            title="No network activity yet"
            description="Once transactions land, the graph maps every counterparty relationship automatically."
          />
        ) : (
          <NetworkGraph nodes={graph.nodes} edges={graph.edges} />
        )}
        {graph.truncated ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Showing the {graph.nodes.length} busiest entities out of a larger set. Narrow the date range to see the rest.
          </p>
        ) : null}
      </PageSection>

      {flags.length > 0 ? (
        <PageSection
          id="network-flags"
          title="Structural flags"
          description="Patterns worth a second look, derived from the graph shape itself"
          flush
        >
          <ul className="divide-y divide-border/60">
            {flags.map((flag) => (
              <li key={flag.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12px]">
                <span
                  className={cn(
                    "rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
                    flag.severity === "critical"
                      ? "bg-risk-critical/15 text-risk-critical"
                      : "bg-risk-high/15 text-risk-high",
                  )}
                >
                  {flag.severity}
                </span>
                <span className="font-medium">{flag.label}</span>
                <span className="num text-muted-foreground">{flag.country}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">{flag.reason}</span>
                <Link
                  href={`/app/network/${flag.nodeId}`}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Full profile
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}
    </PageShell>
  );
}
