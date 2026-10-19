"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RISK_COLORS, type RiskLevel } from "@/config/risk";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

const axisStyle = { fontSize: 10, fill: "rgb(var(--muted-foreground))" } as const;

const tooltipStyle = {
  background: "rgb(var(--card))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "rgb(var(--foreground))",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
} as const;

export interface SeriesPoint {
  label: string;
  count: number;
  value: number;
}

function DataToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="rounded px-1 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {open ? "Hide data" : "View data"}
    </button>
  );
}

export function VolumeAreaChart({
  data,
  unit,
  height = 240,
}: {
  data: SeriesPoint[];
  unit: "count" | "value";
  height?: number;
}) {
  const [showTable, setShowTable] = React.useState(false);

  return (
    <div>
      <div
        style={{ height }}
        role="img"
        aria-label={`Transaction ${unit === "count" ? "count" : "value"} over the selected range. Use the data table for exact values.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.7} vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={32} dy={6} />
            <YAxis
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={44}
              tickCount={5}
              tickFormatter={(value: number) => (unit === "value" ? formatCompactNumber(value) : String(value))}
            />
            <Tooltip
              cursor={{ stroke: "rgb(var(--border))" }}
              contentStyle={tooltipStyle}
              formatter={(value: number) =>
                unit === "value"
                  ? [formatCurrency(value, "USD", { maximumFractionDigits: 0 }), "Value"]
                  : [value, "Transactions"]
              }
            />
            <Area
              type="monotone"
              dataKey={unit}
              stroke="rgb(var(--accent))"
              strokeWidth={1.75}
              fill="url(#volumeFill)"
              isAnimationActive={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "rgb(var(--card))", fill: "rgb(var(--accent))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-end">
        <DataToggle open={showTable} onToggle={() => setShowTable((value) => !value)} />
      </div>
      {showTable ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-[6px] border border-border">
          <table className="table-base">
            <caption className="sr-only">Transaction series values</caption>
            <thead className="sticky top-0 bg-card">
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="text-right">Transactions</th>
                <th scope="col" className="text-right">Value (USD)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.label}>
                  <th scope="row" className="font-normal">{point.label}</th>
                  <td className="num text-right">{point.count}</td>
                  <td className="num text-right">{point.value.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const statusColors: Record<string, string> = {
  new: "#E5484D",
  investigating: "#F5B83D",
  escalated: "#F26B3A",
  resolved: "#2FBF71",
  false_positive: "#7C8496",
};

const statusLabels: Record<string, string> = {
  new: "New",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  false_positive: "False positive",
};

/** Status rows with proportional bars keep counts and shares readable at any volume. */
export function AlertBreakdown({
  data,
  total,
}: {
  data: Array<{ status: string; count: number }>;
  total: number;
}) {
  const [showTable, setShowTable] = React.useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">
          <span className="num">{total.toLocaleString("en-US")}</span>
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">alerts in range</span>
        </p>
        <DataToggle open={showTable} onToggle={() => setShowTable((value) => !value)} />
      </div>

      <div
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Alert status split for ${total} alerts: ${data
          .map((entry) => `${statusLabels[entry.status] ?? entry.status} ${entry.count}`)
          .join(", ")}`}
      >
        {data.map((entry) =>
          entry.count > 0 ? (
            <span
              key={entry.status}
              style={{ width: `${(entry.count / Math.max(1, total)) * 100}%`, background: statusColors[entry.status] }}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-3 divide-y divide-border/50">
        {data.map((entry) => {
          const share = total ? Math.round((entry.count / total) * 100) : 0;
          return (
            <li key={entry.status} className="flex items-center gap-2 py-2 text-[12px]">
              <span
                className="size-1.5 rounded-full"
                style={{ background: statusColors[entry.status] }}
                aria-hidden="true"
              />
              <span className="flex-1 text-muted-foreground">{statusLabels[entry.status] ?? entry.status}</span>
              <span className="num font-medium text-foreground">{entry.count}</span>
              <span className="num w-8 text-right text-[11px] text-muted-foreground">{share}%</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-border/60 pt-2 text-[11px] leading-4 text-muted-foreground">
        Share is computed against every alert raised in the selected range.
      </p>
      {showTable ? (
        <table className="table-base mt-1">
          <caption className="sr-only">Alert status counts</caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.status}>
                <th scope="row" className="font-normal">{statusLabels[entry.status] ?? entry.status}</th>
                <td className="num text-right">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function RiskHistogram({
  bins,
  threshold,
  height = 190,
}: {
  bins: Array<{ bin: string; low: number; high: number; count: number; level: RiskLevel }>;
  threshold: number;
  height?: number;
}) {
  const data = bins.map((bin) => ({ ...bin, fill: RISK_COLORS[bin.level] }));

  return (
    <div>
      <div
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Distribution of risk scores in ten-point bands, coloured by risk level."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.7} vertical={false} />
            <XAxis dataKey="low" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "rgb(var(--muted) / 0.5)" }}
              contentStyle={tooltipStyle}
              formatter={(value: number, _name, entry) => {
                const payload = entry.payload as { low: number; high: number };
                return [value, `Score ${payload.low}–${payload.high}`];
              }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((bin) => (
                <Cell key={bin.bin} fill={bin.fill} opacity={bin.low >= threshold ? 0.95 : 0.32} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Bars at or above the alert cutoff of {threshold} raise an alert; lower scores stay monitoring-only.
        </span>
        <span className="flex items-center gap-3">
          {(["low", "medium", "high", "critical"] as RiskLevel[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5 capitalize">
              <span className="size-2 rounded-sm" style={{ background: RISK_COLORS[level] }} aria-hidden="true" />
              {level}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; className?: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full bg-foreground", item.className)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

