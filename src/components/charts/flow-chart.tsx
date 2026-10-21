"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RISK_COLORS, SCORE_BANDS, type RiskLevel } from "@/config/risk";
import type { SeriesBucket } from "@/lib/data/analytics";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

const axisStyle = { fontSize: 11, fill: "rgb(var(--muted-foreground))" } as const;

/** Rounds a chart maximum up to a readable axis value (10, 25, 50, 100…). */
function niceMax(value: number): number {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

const levels: Array<{ key: RiskLevel; label: string }> = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "critical", label: "Critical" },
];

interface TooltipPayload {
  payload: SeriesBucket;
}

function FlowTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SeriesBucket }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = (payload[0] as TooltipPayload).payload;
  return (
    <div className="min-w-[190px] rounded-tile border border-border bg-card/95 p-3 text-[11.5px] shadow-lift backdrop-blur">
      <p className="label-xs">{point.label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-[17px] font-medium leading-5">{point.count.toLocaleString("en-US")}</span>
        <span className="text-muted-foreground">payments</span>
      </p>
      <p className="num mt-0.5 text-muted-foreground">{formatCurrency(point.value, "USD", { maximumFractionDigits: 0 })}</p>
      <div className="mt-2 space-y-1 border-t border-border/70 pt-2">
        {levels.map((level) => (
          <div key={level.key} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: RISK_COLORS[level.key] }} aria-hidden="true" />
            <span className="flex-1 text-muted-foreground">{level.label}</span>
            <span className="num">{point[level.key]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2">
        <span className="text-muted-foreground">Avg score</span>
        <span className={cn("num", point.avgScore >= SCORE_BANDS.alert ? "text-risk-high" : "text-foreground")}>
          {point.avgScore.toFixed(1)}
        </span>
      </div>
      {point.flagged > 0 ? (
        <p className="mt-1.5 rounded-sm bg-risk-critical/12 px-1.5 py-1 text-[11px] text-risk-critical">
          <span className="num">{point.flagged}</span> at or above the alert cutoff
        </p>
      ) : null}
    </div>
  );
}

function MetricToggle({
  value,
  onChange,
}: {
  value: "count" | "value";
  onChange: (next: "count" | "value") => void;
}) {
  return (
    <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Series metric">
      {(["count", "value"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option === "count" ? "Payments" : "Value"}
        </button>
      ))}
    </div>
  );
}

/**
 * The workspace's primary chart: risk mix per period as stacked columns, with
 * the average score traced over the top and the alert cutoff marked so the
 * shape of the risk can be read without opening a table.
 */
export interface FlowMarker {
  at: string;
  label: string;
  severity: RiskLevel;
  title: string;
}

export function FlowChart({
  series,
  height = 300,
  initialMetric = "count",
  showMetricToggle = true,
  markers = [],
  className,
}: {
  series: SeriesBucket[];
  height?: number;
  initialMetric?: "count" | "value";
  showMetricToggle?: boolean;
  /** Measured anomalies to shade on the timeline. */
  markers?: FlowMarker[];
  className?: string;
}) {
  const [metric, setMetric] = React.useState<"count" | "value">(initialMetric);
  const [showTable, setShowTable] = React.useState(false);

  const maxValue = React.useMemo(
    () => Math.max(1, ...series.map((point) => (metric === "count" ? point.count : point.value))),
    [series, metric],
  );

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {levels.map((level) => (
            <span key={level.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-sm" style={{ background: RISK_COLORS[level.key] }} aria-hidden="true" />
              {level.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-0.5 w-3.5 rounded-full bg-accent" aria-hidden="true" />
            Avg score
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showMetricToggle ? <MetricToggle value={metric} onChange={setMetric} /> : null}
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            aria-expanded={showTable}
            className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showTable ? "Hide data" : "View data"}
          </button>
        </div>
      </div>

      <div
        style={{ height }}
        role="img"
        aria-label={`Payment volume by risk band over ${series.length} periods, with the average score line.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {levels.map((level) => (
                <linearGradient key={level.key} id={`flow-${level.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RISK_COLORS[level.key]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={RISK_COLORS[level.key]} stopOpacity={0.45} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={26} dy={6} />
            <YAxis
              yAxisId="bars"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={46}
              tickCount={5}
              domain={[0, niceMax(maxValue * 1.08)]}
              tickFormatter={(value: number) => (metric === "value" ? formatCompactNumber(value) : String(value))}
            />
            <YAxis
              yAxisId="score"
              orientation="right"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={30}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
            />
            {markers.map((marker) => {
              const index = series.findIndex((point) => point.at === marker.at);
              const previous = index > 0 ? series[index - 1] : undefined;
              const colour =
                marker.severity === "critical"
                  ? RISK_COLORS.critical
                  : marker.severity === "high"
                    ? RISK_COLORS.high
                    : RISK_COLORS.medium;
              return (
                <React.Fragment key={`${marker.at}-${marker.title}`}>
                  {previous ? (
                    <ReferenceArea
                      yAxisId="bars"
                      x1={previous.label}
                      x2={marker.label}
                      fill={colour}
                      fillOpacity={0.09}
                      strokeOpacity={0}
                    />
                  ) : null}
                  <ReferenceLine
                    yAxisId="bars"
                    x={marker.label}
                    stroke={colour}
                    strokeOpacity={0.65}
                    strokeDasharray="3 3"
                    label={{ value: "anomaly", position: "insideTopRight", fill: colour, fontSize: 11 }}
                  />
                </React.Fragment>
              );
            })}
            <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgb(var(--muted) / 0.35)" }} />
            <ReferenceLine
              yAxisId="score"
              y={SCORE_BANDS.alert}
              stroke="rgb(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
            {levels.map((level) => (
              <Bar
                key={level.key}
                yAxisId="bars"
                dataKey={metric === "count" ? level.key : `${level.key}Value`}
                stackId="risk"
                fill={`url(#flow-${level.key})`}
                isAnimationActive animationDuration={650}
                maxBarSize={34}
              />
            ))}
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="avgScore"
              stroke="rgb(var(--accent))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "rgb(var(--card))", fill: "rgb(var(--accent))" }}
              isAnimationActive animationDuration={650}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Columns stack {metric === "count" ? "payments" : "USD value"} by risk band; the line traces the average score
        against the right axis. The dashed mark is the alert cutoff at {SCORE_BANDS.alert}.
      </p>

      {showTable ? (
        <div className="mt-3 max-h-60 overflow-y-auto rounded-tile border border-border">
          <table className="table-base">
            <caption className="sr-only">Flow series values by period</caption>
            <thead className="sticky top-0 bg-card">
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="text-right">Payments</th>
                <th scope="col" className="text-right">Value (USD)</th>
                <th scope="col" className="text-right">Flagged</th>
                <th scope="col" className="text-right">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.at}>
                  <th scope="row" className="font-normal">{point.label}</th>
                  <td className="num text-right">{point.count.toLocaleString("en-US")}</td>
                  <td className="num text-right">{point.value.toLocaleString("en-US")}</td>
                  <td className={cn("num text-right", point.flagged > 0 && "text-risk-high")}>{point.flagged}</td>
                  <td className="num text-right">{point.avgScore.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
