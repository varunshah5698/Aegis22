"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface FxSeries {
  code: string;
  points: Array<{ date: string; rate: number }>;
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 10) return value.toFixed(3);
  return value.toFixed(4);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

interface TooltipPoint {
  date: string;
  value: number;
  rate: number;
}

function RateTooltip({
  active,
  payload,
  code,
  indexed,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPoint }>;
  code: string;
  indexed: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div className="min-w-[168px] rounded-tile border border-border bg-card/95 p-2.5 text-[11px] shadow-lift backdrop-blur">
      <p className="label-xs">{formatDate(point.date)}</p>
      <p className="num mt-1.5 text-[15px] font-medium leading-5">
        {indexed ? point.value.toFixed(1) : formatRate(point.rate)}
        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
          {indexed ? `index (${formatDate(payload[0]!.payload.date)})` : `USD/${code}`}
        </span>
      </p>
      <p className="num mt-1 text-muted-foreground">1 {code} = {formatRate(1 / point.rate)} USD</p>
    </div>
  );
}

/**
 * Reference-rate history. Rates are published fixings, not streaming quotes, so
 * the chart labels the source and the fixing date and never animates as if the
 * market were moving live.
 */
export function FxRateChart({
  series,
  initialCode,
  rateDate,
  sourceLabel,
  sourceNote,
}: {
  series: FxSeries[];
  initialCode: string;
  rateDate: string;
  sourceLabel: string;
  sourceNote: string;
}) {
  const [code, setCode] = useState(series.some((entry) => entry.code === initialCode) ? initialCode : series[0]?.code ?? "EUR");
  const [days, setDays] = useState<30 | 90>(30);
  const [indexed, setIndexed] = useState(false);

  const active = series.find((entry) => entry.code === code) ?? series[0];

  const points = useMemo(() => {
    if (!active || active.points.length === 0) return [] as TooltipPoint[];
    // The window is calendar days, so "30d" means 30 days of fixings rather
    // than 30 published points (roughly six weeks at this provider).
    const lastDate = new Date(`${active.points[active.points.length - 1]!.date}T00:00:00Z`).getTime();
    const cutoff = lastDate - days * 86_400_000;
    const inWindow = active.points.filter(
      (point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff,
    );
    const sliced = inWindow.length >= 2 ? inWindow : active.points.slice(-days);
    if (sliced.length === 0) return [];
    const first = sliced[0]!.rate;
    return sliced.map((point) => ({
      date: point.date,
      rate: point.rate,
      value: indexed ? (point.rate / first) * 100 : point.rate,
    }));
  }, [active, days, indexed]);

  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest && first ? ((latest.rate - first.rate) / first.rate) * 100 : null;
  const high = points.length > 0 ? Math.max(...points.map((point) => point.rate)) : 0;
  const low = points.length > 0 ? Math.min(...points.map((point) => point.rate)) : 0;
  const tick = { fontSize: 11, fill: "rgb(var(--muted-foreground))" } as const;
  const span = Math.max(1e-9, (high - low) * 0.25);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-2 rounded-tile border border-border bg-elevated/60 px-2.5 text-[12px] font-medium transition-colors hover:border-border-strong"
                aria-label="Select currency pair"
              >
                <span className="num">USD/{code}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-44 overflow-y-auto">
              <DropdownMenuLabel>Pairs against USD</DropdownMenuLabel>
              {series.map((entry) => (
                <DropdownMenuItem key={entry.code} onSelect={() => setCode(entry.code)} className="num">
                  USD/{entry.code}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="History window">
            {([30, 90] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={days === option}
                onClick={() => setDays(option)}
                className={cn(
                  "rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors",
                  days === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}d
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Value mode">
            {[
              { value: false, label: "Rate" },
              { value: true, label: "Index" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={indexed === option.value}
                onClick={() => setIndexed(option.value)}
                className={cn(
                  "rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors",
                  indexed === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="num">
            {latest ? formatRate(latest.rate) : "—"} <span className="opacity-70">per USD</span>
          </span>
          {change !== null ? (
            <span className={cn("num font-medium", change >= 0 ? "text-risk-low" : "text-risk-high")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}% · {days}d
            </span>
          ) : null}
          <span className="num">
            {formatRate(low)}–{formatRate(high)}
          </span>
        </div>
      </div>

      <div
        style={{ height: 272 }}
        role="img"
        aria-label={`USD to ${code} reference rate over ${days} days. Latest ${latest ? formatRate(latest.rate) : "unavailable"}.`}
      >
        {points.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-tile border border-dashed border-border text-[12px] text-muted-foreground">
            The provider returned too few fixings for a {days}-day chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fx-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--chart-1))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="rgb(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.55} vertical={false} />
              <XAxis
                dataKey="date"
                tick={tick}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                dy={6}
                tickFormatter={(value: string) => formatDate(value)}
              />
              <YAxis
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={58}
                domain={indexed ? ["auto", "auto"] : [low - span, high + span]}
                tickFormatter={(value: number) => (indexed ? value.toFixed(0) : formatRate(value))}
              />
              <Tooltip content={<RateTooltip code={code} indexed={indexed} />} cursor={{ stroke: "rgb(var(--muted-foreground))", strokeDasharray: "3 3" }} />
              <ReferenceLine
                y={indexed ? 100 : first!.rate}
                stroke="rgb(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgb(var(--chart-1))"
                strokeWidth={1.9}
                fill="url(#fx-area)"
                dot={false}
                activeDot={{ r: 3.5, fill: "rgb(var(--chart-1))", stroke: "rgb(var(--card))", strokeWidth: 2 }}
                isAnimationActive animationDuration={650}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>{sourceLabel}</span>
        <span aria-hidden="true">·</span>
        <span className="num">fixing {rateDate}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 flex-1">{sourceNote}</span>
      </p>
    </div>
  );
}
