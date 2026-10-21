import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, Info, TrendingUp } from "lucide-react";

import { MetricRow, PageSection, PageShell, SectionLink, Sparkline } from "@/components/app/page-shell";
import { BarList } from "@/components/charts/bar-list";
import { FxCorrelationGrid, FxExposureSensitivityPanel, FxVolatilityTable } from "@/components/charts/fx-analysis";
import { FxComparisonChart } from "@/components/dashboard/fx-comparison-chart";
import { FxConverter } from "@/components/dashboard/fx-converter";
import { FxRateChart, type FxSeries } from "@/components/dashboard/fx-rate-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { requireOrganization } from "@/lib/auth";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import {
  annualizedVolatility,
  correlationMatrix,
  exposureSensitivity,
  maxDrawdown,
  periodChange,
  rangePosition,
} from "@/lib/fx/analytics";
import { changePercent, FxError, getFxProviderConfig, getLatestRates, getRateHistory } from "@/lib/fx/provider";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "FX intelligence" };

/** Majors the ECB reference set covers, quoted against USD. */
const MAJORS = ["EUR", "GBP", "JPY", "CHF", "CNY", "SGD", "INR", "AUD", "CAD", "HKD", "TRY", "ZAR"];

const TREND_DAYS = 90;

export default async function FxIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ pair?: string }>;
}) {
  const params = await searchParams;
  const { supabase, organization } = await requireOrganization();
  const organizationId = organization!.id;
  const config = getFxProviderConfig();

  const analytics = await getWorkspaceAnalytics(supabase, organizationId, "90d");
  const tradedCurrencies = analytics.currencies;
  const tracked = [...new Set([...MAJORS, ...tradedCurrencies.map((entry) => entry.currency)])].filter(
    (code) => code !== "USD" && /^[A-Z]{3}$/.test(code),
  );

  const to = new Date();
  const from = new Date(to.getTime() - TREND_DAYS * 86_400_000);

  let latest: Awaited<ReturnType<typeof getLatestRates>> | null = null;
  let history: Awaited<ReturnType<typeof getRateHistory>> | null = null;
  let providerError: { code: string; message: string } | null = null;

  try {
    [latest, history] = await Promise.all([
      getLatestRates("USD", tracked),
      getRateHistory("USD", tracked, from, to),
    ]);
  } catch (error) {
    providerError =
      error instanceof FxError
        ? { code: error.code, message: error.message }
        : { code: "unavailable", message: "The FX provider request failed." };
  }

  if (!latest || !history || providerError) {
    return (
      <PageShell
        eyebrow="Market / FX"
        title="FX intelligence"
        description="Reference rates for the currencies this workspace settles in, with the provider clearly identified."
      >
        <PageSection
          id="fx-unavailable"
          title="Market data is unavailable"
          description="The workspace never fabricates rates, so this panel stays empty until the provider responds."
        >
          <div className="flex items-start gap-3 rounded-tile border border-risk-medium/40 bg-risk-medium/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk-medium" aria-hidden="true" />
            <div className="min-w-0 text-[12.5px] leading-5">
              <p className="font-medium text-foreground">{providerError?.message ?? "No rates were returned."}</p>
              <p className="mt-1 text-muted-foreground">
                Provider: <span className="num">{config.id}</span>
                {config.baseUrl ? (
                  <>
                    {" "}
                    · endpoint <span className="num">{config.baseUrl}</span>
                  </>
                ) : null}
                {config.requiresKey && !config.hasKey ? " · FX_API_KEY is not set" : null}
              </p>
            </div>
          </div>
        </PageSection>
      </PageShell>
    );
  }

  const historyPoints = history.points;
  const lastPoint = historyPoints[historyPoints.length - 1];
  const previousPoint = historyPoints.length > 1 ? historyPoints[historyPoints.length - 2] : undefined;

  const rows = tracked
    .filter((code) => typeof latest.rates[code] === "number")
    .map((code) => {
      const rate = latest.rates[code]!;
      const previous = previousPoint?.rates[code];
      const series = historyPoints.map((point) => point.rates[code]).filter((value): value is number => typeof value === "number");
      return {
        code,
        rate,
        inverted: 1 / rate,
        change: typeof previous === "number" ? changePercent(previous, rate) : null,
        series,
        high: series.length > 0 ? Math.max(...series) : rate,
        low: series.length > 0 ? Math.min(...series) : rate,
      };
    })
    .sort((a, b) => MAJORS.indexOf(a.code) - MAJORS.indexOf(b.code) || a.code.localeCompare(b.code));

  const publishedCodes = new Set(Object.keys(latest.rates));
  // USD is the quote base, so it is always covered at parity rather than missing.
  const hasRate = (code: string) => code === "USD" || publishedCodes.has(code);
  const covered = tradedCurrencies.filter((entry) => hasRate(entry.currency));
  const uncovered = tradedCurrencies.filter((entry) => !hasRate(entry.currency));
  const coveredShare =
    analytics.totals.value > 0 ? covered.reduce((total, entry) => total + entry.value, 0) / analytics.totals.value : 0;

  const movers = rows
    .filter((row): row is typeof row & { change: number } => row.change !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);

  const strongest = movers[0] ?? null;

  const chartCodes = [...new Set([...MAJORS, ...tradedCurrencies.slice(0, 10).map((entry) => entry.currency)])].filter(
    (code) => code !== "USD" && typeof latest!.rates[code] === "number",
  );
  const chartSeries: FxSeries[] = chartCodes
    .map((code) => ({
      code,
      points: historyPoints
        .map((point) => ({ date: point.date, rate: point.rates[code] }))
        .filter((point): point is { date: string; rate: number } => typeof point.rate === "number"),
    }))
    .filter((entry) => entry.points.length >= 2);

  const initialPair = params.pair?.toUpperCase() ?? "EUR";

  const pairPoints = (code: string) =>
    historyPoints
      .map((point) => ({ date: point.date, rate: point.rates[code] }))
      .filter((point): point is { date: string; rate: number } => typeof point.rate === "number");

  // 30 days means 30 calendar days, so the label matches what was measured.
  const lastFixingDate = historyPoints[historyPoints.length - 1]?.date ?? latest.rateDate;
  const cutoff30 = new Date(new Date(`${lastFixingDate}T00:00:00Z`).getTime() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const pairAnalytics = chartSeries.map((entry) => {
    const points = pairPoints(entry.code);
    return {
      code: entry.code,
      annualizedVolPercent: annualizedVolatility(points),
      change30d: periodChange(points.filter((point) => point.date >= cutoff30)),
      change90d: periodChange(points),
      range: rangePosition(points),
      drawdown90d: maxDrawdown(points),
    };
  });

  const volatilityRows = [...pairAnalytics].sort(
    (a, b) => (b.annualizedVolPercent ?? -1) - (a.annualizedVolPercent ?? -1),
  );
  const deepestDrawdown = volatilityRows.reduce<{ code: string; value: number } | null>((worst, row) => {
    if (row.drawdown90d === null) return worst;
    if (!worst || row.drawdown90d > worst.value) return { code: row.code, value: row.drawdown90d };
    return worst;
  }, null);

  const volatilityByCurrency: Record<string, number | null> = Object.fromEntries(
    pairAnalytics.map((row) => [row.code, row.annualizedVolPercent]),
  );
  const sensitivity = exposureSensitivity(
    tradedCurrencies.map((entry) => ({ currency: entry.currency, value: entry.value, count: entry.count })),
    volatilityByCurrency,
  );

  const correlationCodes = [
    ...new Set([
      ...tradedCurrencies.filter((entry) => hasRate(entry.currency)).map((entry) => entry.currency),
      ...chartCodes,
    ]),
  ]
    .filter((code) => code !== "USD" && typeof latest!.rates[code] === "number")
    .slice(0, 8);
  const correlationGrid = correlationMatrix(
    correlationCodes.map((code) => ({ code, points: pairPoints(code) })),
  );

  const comparisonDefaults = [
    ...new Set([
      ...tradedCurrencies.filter((entry) => hasRate(entry.currency)).map((entry) => entry.currency),
      "EUR",
      "GBP",
    ]),
  ]
    .filter((code) => code !== "USD" && chartSeries.some((entry) => entry.code === code))
    .slice(0, 3);

  return (
    <PageShell
      eyebrow="Market / FX"
      title="FX intelligence"
      description="Published reference rates, the workspace's currency exposure and the conversions used for scoring. Rates are fixings, never presented as live market quotes."
      meta={
        <>
          <span className="chip">source {latest.source.label}</span>
          <span className="chip">
            fixing date <span className="num">{latest.rateDate}</span>
          </span>
          <span className="chip">
            {latest.source.kind === "reference" ? "published fixing" : "streaming quote"}
            {latest.source.delayed ? " · not live" : ""}
          </span>
          <span className="chip">
            {rows.length} pairs tracked · {TREND_DAYS}d history
          </span>
        </>
      }
    >
      <MetricRow>
        <KpiCard
          label="Pairs tracked"
          value={rows.length}
          icon={Banknote}
          comparison={`quoted against USD · ${TREND_DAYS}-day history`}
          definition="Currencies with a published reference rate against USD: the tracked majors plus every currency this workspace has settled in."
        />
        <KpiCard
          label="Strongest mover"
          value={strongest ? `${strongest.code} ${strongest.change > 0 ? "+" : ""}${strongest.change.toFixed(2)}%` : "—"}
          icon={TrendingUp}
          tone="accent"
          comparison="against the previous fixing"
          definition="Largest absolute change between the latest two published fixings. A USD/XXX rise means XXX weakened against the dollar."
          {...(strongest ? { href: `/app/fx?pair=${strongest.code}` } : {})}
        />
        <KpiCard
          label="Value with a rate"
          value={`${(coveredShare * 100).toFixed(1)}%`}
          icon={Info}
          tone={coveredShare > 0.95 ? "positive" : "warning"}
          comparison={`${uncovered.length} currencies without a rate`}
          definition="Share of 90-day screened USD value settled in currencies the provider publishes. Figures are never converted through an invented cross-rate."
        />
        <KpiCard
          label="Traded with a rate"
          value={`${covered.length}/${tradedCurrencies.length}`}
          icon={AlertTriangle}
          tone={uncovered.length > 0 ? "warning" : "positive"}
          comparison={uncovered.length > 0 ? uncovered.map((entry) => entry.currency).join(", ") : "every traded currency has a rate"}
          definition="Traded currencies that map to a published fixing. Anything missing is flagged here and on the exposure panel rather than silently converted."
        />
      </MetricRow>

      <div className="workspace-row">
        <PageSection
          id="history-heading"
          className="xl:col-span-9"
          title="Reference rate history"
          description="Daily fixings from the provider, with a 30 or 90-day window and an index mode for comparing shape across pairs"
          action={<SectionLink href={`/app/analytics?range=90d`}>Exposure in analytics</SectionLink>}
          bodyClassName="px-5 pb-4 pt-4"
        >
          <FxRateChart
            series={chartSeries}
            initialCode={initialPair}
            rateDate={latest.rateDate}
            sourceLabel={latest.source.label}
            sourceNote={latest.source.note}
          />
        </PageSection>

        <PageSection
          id="movers-heading"
          className="xl:col-span-3"
          title="Movers since the last fixing"
          description="Largest absolute moves; select a pair to load it in the chart"
          action={<SectionLink href="/app/transactions">Payments</SectionLink>}
          flush
        >
          {movers.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">
              Only one fixing is available, so no daily move can be measured yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {movers.map((row) => (
                <li key={row.code}>
                  <Link
                    href={`/app/fx?pair=${row.code}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <span className="num w-[66px] shrink-0 text-[12.5px] font-medium">USD/{row.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="num block text-[11px] text-muted-foreground">
                        {row.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </span>
                      <span className="num block text-[11px] text-muted-foreground/80">
                        {row.low.toLocaleString("en-US", { maximumFractionDigits: 3 })}–
                        {row.high.toLocaleString("en-US", { maximumFractionDigits: 3 })} · {TREND_DAYS}d
                      </span>
                    </span>
                    <span className={cn("num shrink-0 text-[12px] font-medium", row.change >= 0 ? "text-risk-low" : "text-risk-high")}>
                      {row.change >= 0 ? "+" : ""}
                      {row.change.toFixed(2)}%
                    </span>
                    <span className={cn("shrink-0", row.change >= 0 ? "text-risk-low/80" : "text-risk-high/80")}>
                      <Sparkline values={row.series} className="h-6 w-14" fill={false} strokeWidth={1.4} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-4 text-muted-foreground">
            A positive move means the quote currency strengthened against the dollar. This is a reference fixing, so it is
            not an executable rate.
          </div>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="comparison-heading"
          className="xl:col-span-8"
          title="Cross-pair performance"
          description="Indexed to 100 at the first fixing in the window, so shape and relative move are comparable across pairs"
          action={<SectionLink href="/app/corridors">Corridor flows</SectionLink>}
          bodyClassName="px-5 pb-4 pt-4"
        >
          <FxComparisonChart series={chartSeries} initialCodes={comparisonDefaults} />
        </PageSection>

        <PageSection
          id="volatility-heading"
          className="xl:col-span-4"
          title="Volatility and range"
          description={
            deepestDrawdown
              ? `Annualised vol and 90-day range; deepest drawdown ${deepestDrawdown.value.toFixed(1)}% on USD/${deepestDrawdown.code}`
              : "Annualised vol and 90-day range position"
          }
          flush
        >
          <FxVolatilityTable rows={volatilityRows} />
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="converter-heading"
          className="xl:col-span-5"
          title="Currency converter"
          description={`Convert at the ${latest.rateDate} published fixing`}
        >
          <FxConverter
            currencies={["USD", ...tracked.filter((code) => publishedCodes.has(code))].filter(
              (code, index, list) => list.indexOf(code) === index,
            )}
          />
          <p className="mt-4 flex items-start gap-2 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{latest.source.note}</span>
          </p>
        </PageSection>

        <PageSection
          id="pairs-heading"
          className="xl:col-span-7"
          title="Reference rates"
          description={`Latest fixing, inverse, ${TREND_DAYS}-day range and the move against the previous published day`}
          flush
        >
          <div className="overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <caption className="sr-only">Reference rates for tracked currency pairs</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5">Pair</th>
                  <th scope="col" className="text-right">Rate</th>
                  <th scope="col" className="text-right">Inverse</th>
                  <th scope="col" className="text-right">{TREND_DAYS}d range</th>
                  <th scope="col" className="text-right">Change</th>
                  <th scope="col" className="pr-5 text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row" className="num pl-5 text-left font-normal">
                      <Link href={`/app/fx?pair=${row.code}`} className="hover:underline">
                        USD/{row.code}
                      </Link>
                    </th>
                    <td className="num text-right">{row.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                    <td className="num text-right text-muted-foreground">
                      {row.inverted.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="num text-right text-muted-foreground">
                      {row.low.toLocaleString("en-US", { maximumFractionDigits: 3 })}–
                      {row.high.toLocaleString("en-US", { maximumFractionDigits: 3 })}
                    </td>
                    <td
                      className={cn(
                        "num text-right",
                        row.change === null ? "text-muted-foreground" : row.change > 0 ? "text-risk-low" : "text-risk-high",
                      )}
                    >
                      {row.change === null ? "—" : `${row.change > 0 ? "+" : ""}${row.change.toFixed(2)}%`}
                    </td>
                    <td className="pr-5">
                      <span
                        className={cn(
                          "flex justify-end",
                          row.change === null ? "text-muted-foreground" : row.change >= 0 ? "text-risk-low/70" : "text-risk-high/70",
                        )}
                      >
                        <Sparkline values={row.series} className="h-5 w-20" fill={false} strokeWidth={1.4} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
            {lastPoint ? <span className="num">History through {lastPoint.date}</span> : null} · rates refresh at most hourly
            and change once per working day at this provider.
          </div>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="exposure-heading"
          className="xl:col-span-8"
          title="Currency exposure from payments"
          description={`Screened value by settlement currency over the last ${TREND_DAYS} days, converted to USD`}
        >
          <BarList
            items={tradedCurrencies.map((entry) => ({
              key: entry.currency,
              label: (
                <span className="inline-flex items-center gap-2">
                  <span className="num">{entry.currency}</span>
                  {hasRate(entry.currency) ? null : (
                    <span className="rounded-[5px] bg-risk-medium/15 px-1.5 py-0.5 text-[11px] text-risk-medium">
                      no reference rate
                    </span>
                  )}
                </span>
              ),
              value: entry.value,
              display: `${formatCompactNumber(entry.value)} USD`,
              secondary: `${entry.count} pmts`,
              color: hasRate(entry.currency) ? "rgb(var(--chart-1))" : "rgb(var(--risk-medium))",
            }))}
          />
          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
            Exposure comes from scored payments in this workspace. Currencies the provider does not publish are shown with a
            clear marker rather than converted through an invented cross-rate. Average ticket in view:{" "}
            <span className="num">
              {formatCurrency(analytics.totals.value / Math.max(1, analytics.totals.count), "USD", { maximumFractionDigits: 0 })}
            </span>
            .
          </p>
        </PageSection>

        <PageSection
          id="coverage-heading"
          className="xl:col-span-4"
          title="Rate coverage"
          description="Which traded currencies have a published reference rate"
        >
          <ul className="space-y-2.5">
            {tradedCurrencies.map((entry) => {
              const covered = hasRate(entry.currency);
              return (
                <li key={entry.currency} className="flex items-center gap-2.5">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-sm", covered ? "bg-risk-low" : "bg-risk-medium")}
                    aria-hidden="true"
                  />
                  <span className="num w-12 shrink-0 text-[12px]">{entry.currency}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                    {entry.currency === "USD"
                      ? "base currency · 1.0000"
                      : covered
                        ? `${(latest.rates[entry.currency] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 })} per USD`
                        : "not published by the provider"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
            Analytics that need a conversion use this same coverage rule, so settlement mix and exposure figures agree
            across Overview, Analytics and Reports.{" "}
            <Link href="/app/analytics" className="font-medium text-foreground underline decoration-border decoration-1 underline-offset-2">
              Open analytics
            </Link>
          </p>
        </PageSection>
      </div>

      <div className="workspace-row">
        <PageSection
          id="co-movement-heading"
          className="xl:col-span-8"
          title="Rate co-movement"
          description={`Pairwise correlation of daily fixings across ${correlationGrid.codes.length} pairs over the ${TREND_DAYS}-day window`}
          flush
        >
          <div className="px-5 pb-4 pt-4">
            <FxCorrelationGrid matrix={correlationGrid} />
          </div>
        </PageSection>

        <PageSection
          id="sensitivity-heading"
          className="xl:col-span-4"
          title="Exposure sensitivity"
          description="Screened USD value by currency, weighted by each currency's measured volatility"
          bodyClassName="px-5 py-4"
        >
          <FxExposureSensitivityPanel sensitivity={sensitivity} />
        </PageSection>
      </div>
    </PageShell>
  );
}
