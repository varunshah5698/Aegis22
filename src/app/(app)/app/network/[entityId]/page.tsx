import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Network, ShieldAlert } from "lucide-react";

import { MetricRow, MetricTile, PageSection } from "@/components/app/page-shell";
import { EntityFlowChart } from "@/components/dashboard/entity-flow";
import { RiskBadge } from "@/components/risk-badge";
import { RISK_COLORS, scoreToLevel } from "@/config/risk";
import { requireOrganization } from "@/lib/auth";
import { parseRange, rangeOptions } from "@/lib/data/common";
import { getEntityProfile } from "@/lib/data/entity";
import { formatAmount, formatCompactNumber, formatCurrency, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Entity profile" };

const KIND_LABEL: Record<string, string> = {
  individual: "Individual",
  company: "Company",
  intermediary: "Intermediary",
};

function when(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ entityId }, query] = await Promise.all([params, searchParams]);
  const range = parseRange(query.range, "90d");
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? range;
  const { supabase, organization } = await requireOrganization();
  const profile = await getEntityProfile(supabase, organization!.id, entityId, range);

  if (!profile) notFound();

  const { entity, totals, flow, counterparties, accounts, transactions, flags, corridors } = profile;
  const passThrough = totals.inValue > 0 ? Math.round((totals.outValue / totals.inValue) * 100) : null;
  const riskColor = RISK_COLORS[scoreToLevel(totals.averageScore)];
  const flaggedShare = totals.inCount + totals.outCount > 0 ? totals.flagged / (totals.inCount + totals.outCount) : 0;

  return (
    <div className="workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/network?range=${range}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Network
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">window {rangeLabel}</span>
          <Link
            href={`/app/transactions?q=${encodeURIComponent(entity.legalName)}`}
            className="chip transition-colors hover:text-foreground"
          >
            <Network className="size-3" aria-hidden="true" /> All transfers
          </Link>
          <Link
            href={`/app/analyst?range=${range}`}
            className="chip transition-colors hover:text-foreground"
          >
            Ask the analyst <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border text-[15px] font-semibold"
            style={{ borderColor: `${riskColor}55`, color: riskColor, background: `${riskColor}14` }}
            aria-hidden="true"
          >
            {initials(entity.legalName)}
          </span>
          <div className="min-w-0">
            <p className="label-xs">
              {KIND_LABEL[entity.kind] ?? entity.kind} · {entity.country}
            </p>
            <h1 className="mt-1 truncate font-display text-[26px] font-semibold leading-8 tracking-[-0.035em]">
              {entity.legalName}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="num">{accounts.length} {accounts.length === 1 ? "account" : "accounts"}</span>
              <span aria-hidden="true">·</span>
              <span className="num">avg score {totals.averageScore}</span>
              <span aria-hidden="true">·</span>
              <span className="num">peak {totals.maxScore}</span>
              {entity.incorporatedOn ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="num">incorporated {entity.incorporatedOn.slice(0, 10)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={scoreToLevel(totals.averageScore)} />
          {entity.pep ? <span className="chip border-risk-critical/40 text-risk-critical">PEP</span> : null}
          {entity.nominee ? <span className="chip border-chart-3/40 text-chart-3">Nominee director</span> : null}
        </div>
      </header>

      <MetricRow>
        <MetricTile
          label="Received"
          value={`$${formatCompactNumber(totals.inValue)}`}
          hint={`${totals.inCount} inbound ${totals.inCount === 1 ? "transfer" : "transfers"}`}
          tone="positive"
        />
        <MetricTile
          label="Sent out"
          value={`$${formatCompactNumber(totals.outValue)}`}
          hint={`${totals.outCount} outbound ${totals.outCount === 1 ? "transfer" : "transfers"}`}
          tone="warning"
        />
        <MetricTile
          label="Pass-through"
          value={passThrough === null ? "—" : `${passThrough}%`}
          hint="outbound value against inbound value"
        />
        <MetricTile
          label="Flagged flows"
          value={totals.flagged.toLocaleString("en-US")}
          hint={`${(flaggedShare * 100).toFixed(1)}% of this entity's transfers`}
          tone={totals.flagged > 0 ? "critical" : "default"}
        />
      </MetricRow>

      <div className="workspace-row">
        <PageSection
          id="entity-flow"
          title="Directional flow"
          description={`Value in and out of this entity over the last ${rangeLabel}`}
          className="xl:col-span-9"
          action={<span className="num text-[10.5px] text-muted-foreground">{flow.length} buckets</span>}
        >
          <EntityFlowChart flow={flow} />
        </PageSection>

        <PageSection
          id="entity-flags"
          title="Why this entity is interesting"
          description="Derived from the entity record and the window's flows"
          className="xl:col-span-3"
          flush
        >
          {flags.length === 0 ? (
            <p className="px-5 py-6 text-[12px] leading-5 text-muted-foreground">
              No structural flags in this window. The entity is moving value without the patterns this model watches
              for.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {flags.map((flag) => (
                <li key={flag.id} className="flex gap-2.5 px-5 py-3">
                  <ShieldAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    style={{ color: flag.severity === "critical" ? RISK_COLORS.critical : RISK_COLORS.medium }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium leading-5">{flag.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{flag.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {corridors.length > 0 ? (
            <div className="border-t border-border/60 px-5 py-3.5">
              <p className="label-xs">Corridor exposure</p>
              <ul className="mt-2.5 space-y-2">
                {corridors.map((corridor) => (
                  <li key={corridor.corridor}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="num">{corridor.corridor}</span>
                      <span className="num text-muted-foreground">${formatCompactNumber(corridor.value)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-foreground/45"
                        style={{ width: `${Math.max(4, (corridor.value / Math.max(1, corridors[0]!.value)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="entity-counterparties"
          title="Counterparties"
          description="Largest relationships in this window, with this entity's direction"
          className="xl:col-span-8"
          flush
        >
          {counterparties.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted-foreground">No mapped counterparties in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[560px]">
                <caption className="sr-only">Counterparties by screened value</caption>
                <thead>
                  <tr>
                    <th scope="col">Counterparty</th>
                    <th scope="col">Direction</th>
                    <th scope="col" className="text-right">Value (USD)</th>
                    <th scope="col" className="text-right">Transfers</th>
                    <th scope="col" className="text-right">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {counterparties.map((row) => (
                    <tr key={`${row.direction}-${row.entityId ?? row.name}`}>
                      <th scope="row" className="font-normal">
                        {row.entityId ? (
                          <Link
                            href={`/app/network/${row.entityId}?range=${range}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                        <span className="num ml-1.5 text-[10.5px] text-muted-foreground">{row.country}</span>
                      </th>
                      <td>
                        <span
                          className={`num rounded-[5px] px-1.5 py-0.5 text-[10px] ${
                            row.direction === "out" ? "bg-chart-3/15 text-chart-3" : "bg-risk-low/15 text-risk-low"
                          }`}
                        >
                          {row.direction === "out" ? "OUT" : "IN"}
                        </span>
                      </td>
                      <td className="num text-right">{formatCompactNumber(row.value)}</td>
                      <td className="num text-right text-muted-foreground">{row.count}</td>
                      <td className="num text-right">{row.averageScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>

        <PageSection
          id="entity-accounts"
          title="Accounts on record"
          description="Each account is a settlement endpoint, not a separate customer"
          className="xl:col-span-4"
          flush
        >
          {accounts.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted-foreground">No accounts linked to this entity.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="num rounded-[6px] border border-border bg-muted/50 px-1.5 py-0.5 text-[10.5px]">
                    {account.currency}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="num truncate text-[11.5px] font-medium">{account.externalRef}</p>
                    <p className="num text-[10.5px] text-muted-foreground">
                      opened {account.openedAt.slice(0, 10)} · {account.riskTier} tier
                    </p>
                  </div>
                  <span className="chip capitalize">{account.status}</span>
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      </div>

      <PageSection
        id="entity-transfers"
        title="Latest transfers"
        description="Open any row to reach the full scoring workbench"
        className="min-w-0"
        flush
      >
        {transactions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px] font-medium">No transfers in this window</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">Widen the range to see earlier activity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <caption className="sr-only">Latest transfers for this entity</caption>
              <thead>
                <tr>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Counterparty</th>
                  <th scope="col">Corridor</th>
                  <th scope="col" className="text-right">Amount</th>
                  <th scope="col" className="text-right">Score</th>
                  <th scope="col" className="text-right">Level</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-[11px] text-muted-foreground">{when(row.createdAt)}</td>
                    <td>
                      <Link href={`/app/transactions/${row.id}`} className="num font-medium underline-offset-4 hover:underline">
                        {row.externalId}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate">
                      {row.senderName === entity.legalName ? row.receiverName : row.senderName}
                    </td>
                    <td className="num">{row.senderCountry}→{row.receiverCountry}</td>
                    <td className="num whitespace-nowrap text-right">{formatAmount(row.amount, row.currency)}</td>
                    <td className="num text-right">{Math.round(row.riskScore)}</td>
                    <td className="text-right">
                      <RiskBadge level={row.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      <p className="text-[11px] leading-4 text-muted-foreground">
        Figures cover {profile.range.from.slice(0, 10)} → {profile.range.to.slice(0, 10)} UTC and use the USD base value
        recorded at ingestion. A structural flag is a reason to look, not a finding — {formatCurrency(totals.inValue + totals.outValue, "USD", { maximumFractionDigits: 0 })} moved
        through this entity in the window.
      </p>
    </div>
  );
}
