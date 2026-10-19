"use client";

import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, TriangleAlert } from "lucide-react";

import type { SeriesBucket } from "@/lib/data/analytics";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

const axisStyle = { fontSize: 10, fill: "rgb(var(--muted-foreground))" } as const;

/** Rounds an axis maximum to a readable figure (800K rather than 718.9K). */
function niceCeiling(value: number): number {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

/** Trailing median of the previous buckets, the same baseline the findings use. */
function trailingMedian(values: number[], index: number, window = 6): number | null {
  const history = values.slice(Math.max(0, index - window), index);
  if (history.length < 3) return null;
  const sorted = [...history].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

interface Point {
  label: string;
  at: string;
  primary: number;
  baseline: number | null;
  flagged: number;
  count: number;
  value: number;
  avgScore: number;
}

function TrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
  metric: "value" | "count";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  const deviation =
    point.baseline && point.baseline > 0 ? ((point.primary - point.baseline) / point.baseline) * 100 : null;

  return (
    <div className="min-w-[196px] rounded-tile border border-border bg-card/95 p-3 text-[11.5px] shadow-lift backdrop-blur">
      <p className="label-xs">{point.label}</p>
      <p className="num mt-1.5 text-[18px] font-medium leading-6">
        {metric === "value" ? formatCurrency(point.value, "USD", { maximumFractionDigits: 0 }) : `${point.count} payments`}
      </p>
      <div className="mt-2 space-y-1 border-t border-border/70 pt-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Payments</span>
          <span className="num">{point.count.toLocaleString("en-US")}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Trailing median</span>
          <span className="num">
            {point.baseline === null
              ? "insufficient history"
              : metric === "value"
                ? formatCurrency(point.baseline, "USD", { maximumFractionDigits: 0 })
                : Math.round(point.baseline).toLocaleString("en-US")}
          </span>
        </div>
        {deviation !== null ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Deviation</span>
            <span className={cn("num", Math.abs(deviation) >= 30 ? "text-risk-medium" : "text-foreground")}>
              {deviation >= 0 ? "+" : ""}
              {deviation.toFixed(0)}%
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Avg score</span>
          <span className="num">{point.avgScore.toFixed(1)}</span>
        </div>
      </div>
      {point.flagged > 0 ? (
        <p className="mt-2 rounded-sm bg-risk-critical/12 px-1.5 py-1 text-[11px] text-risk-critical">
          <span className="num">{point.flagged}</span> at or above the alert cutoff
        </p>
      ) : null}
    </div>
  );
}

export interface ValueCallout {
  title: string;
  label: string;
  detail: string;
  observed: number;
  baseline: number;
  unit: "usd" | "count";
  href: string;
}

/**
 * The executive time-series: one measured series, its trailing median and the
 * shaded bucket a finding points at. The callout is attached to the same
 * numbers the chart plots, never a separately authored headline.
 */
export function ValueTrendChart({
  series,
  callout,
  height = 300,
  initialMetric = "value",
  bucket,
  className,
}: {
  series: SeriesBucket[];
  callout: ValueCallout | null;
  height?: number;
  initialMetric?: "value" | "count";
  bucket: "hour" | "day";
  className?: string;
}) {
  const [metric, setMetric] = React.useState<"value" | "count">(initialMetric);
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [shape, setShape] = React.useState<"area" | "bars">("area");

  const points = React.useMemo<Point[]>(() => {
    const values = series.map((point) => (metric === "value" ? point.value : point.count));
    return series.map((point, index) => ({
      label: point.label,
      at: point.at,
      primary: values[index]!,
      baseline: trailingMedian(values, index),
      flagged: point.flagged,
      count: point.count,
      value: point.value,
      avgScore: point.avgScore,
    }));
  }, [series, metric]);

  const calloutIndex = React.useMemo(() => {
    if (!callout) return -1;
    return points.findIndex((point) => callout.label === point.label);
  }, [callout, points]);
  const calloutPoint = calloutIndex >= 0 ? points[calloutIndex]! : null;
  const calloutStart = calloutIndex > 0 ? points[calloutIndex - 1]!.label : null;

  const max = niceCeiling(Math.max(1, ...points.map((point) => point.primary)) * 1.08);
  const axisTick = (value: number) =>
    metric === "value" ? `$${formatCompactNumber(value)}` : String(Math.round(value));

  const tooltip = <TrendTooltip metric={metric} />;

  return (
    <div className={cn(className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-accent" aria-hidden="true" />
            {metric === "value" ? "Screened value" : "Payments scored"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-0 w-3.5 border-t border-dashed border-muted-foreground/70" aria-hidden="true" />
            Trailing median
          </span>
          {calloutPoint ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-risk-medium">
              <span className="size-2 rounded-full bg-risk-medium/80" aria-hidden="true" />
              Measured deviation
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Chart metric">
            {(["value", "count"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
                className={cn(
                  "rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors",
                  metric === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "value" ? "Value" : "Payments"}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Chart shape">
            {(["area", "bars"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={shape === option}
                onClick={() => setShape(option)}
                className={cn(
                  "rounded-[7px] px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                  shape === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="hidden rounded-tile border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground sm:inline">
            {bucket === "hour" ? "Hourly" : "Daily"}
          </span>
          <button
            type="button"
            onClick={() => setView((current) => (current === "chart" ? "table" : "chart"))}
            aria-expanded={view === "table"}
            className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {view === "table" ? "Chart" : "Data"}
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="max-h-[320px] overflow-y-auto rounded-tile border border-border" style={{ minHeight: height }}>
          <table className="table-base">
            <caption className="sr-only">Measured series by period</caption>
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="text-right">Payments</th>
                <th scope="col" className="text-right">Value (USD)</th>
                <th scope="col" className="text-right">Trailing median</th>
                <th scope="col" className="text-right">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.at}>
                  <th scope="row" className="font-normal">{point.label}</th>
                  <td className="num text-right">{point.count.toLocaleString("en-US")}</td>
                  <td className="num text-right">{point.value.toLocaleString("en-US")}</td>
                  <td className="num text-right text-muted-foreground">
                    {point.baseline === null ? "—" : Math.round(point.baseline).toLocaleString("en-US")}
                  </td>
                  <td className={cn("num text-right", point.flagged > 0 && "text-risk-high")}>{point.flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="relative"
          style={{ height }}
          role="img"
          aria-label={`${metric === "value" ? "Screened value" : "Payment count"} per ${bucket === "hour" ? "hour" : "day"} across ${points.length} periods, with a trailing median and shaded measured deviation.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {shape === "area" ? (
              <AreaChart data={points} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="value-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.55} vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={28} dy={6} />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickCount={5}
                  domain={[0, max]}
                  tickFormatter={axisTick}
                />
                {calloutPoint && calloutStart ? (
                  <ReferenceArea
                    x1={calloutStart}
                    x2={calloutPoint.label}
                    fill="rgb(var(--risk-medium))"
                    fillOpacity={0.08}
                    stroke="rgb(var(--risk-medium))"
                    strokeOpacity={0.3}
                    strokeDasharray="3 3"
                  />
                ) : null}
                <Tooltip content={tooltip} cursor={{ stroke: "rgb(var(--border-strong))", strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="primary"
                  stroke="rgb(var(--accent))"
                  strokeWidth={2}
                  fill="url(#value-area)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--card))", fill: "rgb(var(--accent))" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart data={points} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.55} vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={28} dy={6} />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickCount={5}
                  domain={[0, max * 1.1]}
                  tickFormatter={axisTick}
                />
                <Tooltip content={tooltip} cursor={{ fill: "rgb(var(--muted) / 0.35)" }} />
                <Bar dataKey="primary" fill="rgb(var(--accent))" radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive={false} />
              </BarChart>
            )}
          </ResponsiveContainer>

          {callout && calloutPoint ? (
            <div className="pointer-events-none absolute right-2 top-1 hidden w-[236px] xl:block">
              <div className="pointer-events-auto rounded-tile border border-risk-medium/40 bg-[linear-gradient(180deg,rgb(var(--risk-medium)/0.12),rgb(var(--card)/0.97))] p-3 shadow-lift backdrop-blur">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-risk-medium">
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Anomaly detected
                </p>
                <p className="num mt-1.5 text-[11px] text-muted-foreground">{callout.label}</p>
                <p className="mt-1.5 text-[11.5px] leading-4 text-foreground/90">{callout.detail}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-risk-medium/20 pt-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Observed</p>
                    <p className="num mt-0.5 text-[12px] font-medium">
                      {callout.unit === "usd" ? `$${formatCompactNumber(callout.observed)}` : callout.observed.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Baseline</p>
                    <p className="num mt-0.5 text-[12px] font-medium">
                      {callout.unit === "usd" ? `$${formatCompactNumber(callout.baseline)}` : callout.baseline.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
                <Link
                  href={callout.href}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-[7px] border border-risk-medium/40 bg-risk-medium/10 px-2.5 py-1.5 text-[11px] font-medium text-risk-medium transition-colors hover:bg-risk-medium/15"
                >
                  View anomaly <ArrowUpRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {callout && calloutPoint ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-tile border border-risk-medium/25 bg-risk-medium/[0.06] px-3 py-2 xl:hidden">
          <p className="min-w-0 flex-1 text-[11.5px] leading-4 text-muted-foreground">
            <span className="font-medium text-risk-medium">Anomaly · {callout.label}.</span> {callout.detail}
          </p>
          <Link href={callout.href} className="inline-flex items-center gap-1 text-[11px] font-medium text-risk-medium">
            View anomaly <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <p className="mt-2.5 text-[10.5px] leading-4 text-muted-foreground">
        Trailing median is the median of the previous six {bucket === "hour" ? "hours" : "days"} in this window. It needs
        three earlier buckets before it is drawn, so a short window shows an empty baseline rather than a guess.
      </p>
    </div>
  );
}
