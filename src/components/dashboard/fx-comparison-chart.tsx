"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ComparisonSeries {
  code: string;
  points: Array<{ date: string; rate: number }>;
}

const COLORS = ["rgb(var(--chart-1))", "rgb(var(--chart-2))", "rgb(var(--chart-3))", "rgb(var(--chart-4))"];

const MAX_PAIRS = 4;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

interface Row {
  date: string;
  [key: string]: string | number | null;
}

/**
 * Cross-pair comparison. Every pair is rebased to 100 at the first fixing in
 * the selected window so shapes are comparable across quote conventions; the
 * tooltip keeps the actual fixing so the index never hides the real number.
 */
export function FxComparisonChart({
  series,
  initialCodes,
}: {
  series: ComparisonSeries[];
  initialCodes: string[];
}) {
  const available = series.filter((entry) => entry.points.length >= 2);
  const [codes, setCodes] = useState<string[]>(() => {
    const preferred = initialCodes.filter((code) => available.some((entry) => entry.code === code));
    const fallback = available.slice(0, 3).map((entry) => entry.code);
    // Three lines by default: enough to compare, and one slot stays free to add.
    return [...new Set([...preferred, ...fallback])].slice(0, Math.min(3, MAX_PAIRS));
  });
  const [days, setDays] = useState<30 | 90>(90);

  const { rows, stats } = useMemo(() => {
    const selected = available.filter((entry) => codes.includes(entry.code));
    const sliced = selected.map((entry) => {
      const last = entry.points[entry.points.length - 1]!.date;
      const cutoff = new Date(`${last}T00:00:00Z`).getTime() - days * 86_400_000;
      const inWindow = entry.points.filter(
        (point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff,
      );
      return { code: entry.code, points: inWindow.length >= 2 ? inWindow : entry.points.slice(-days) };
    });
    const dateSet = new Set<string>();
    for (const entry of sliced) for (const point of entry.points) dateSet.add(point.date);
    const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

    const lookup = new Map<string, Map<string, number>>();
    const summary: Array<{ code: string; change: number | null; latest: number | null }> = [];
    for (const entry of sliced) {
      const first = entry.points[0]!.rate;
      const latest = entry.points[entry.points.length - 1]!.rate;
      lookup.set(entry.code, new Map(entry.points.map((point) => [point.date, point.rate] as const)));
      summary.push({
        code: entry.code,
        latest,
        change: first > 0 ? (latest / first - 1) * 100 : null,
      });
    }

    return {
      rows: dates.map((date) => {
        const row: Row = { date };
        for (const entry of sliced) {
          const rate = lookup.get(entry.code)?.get(date);
          const first = entry.points[0]!.rate;
          row[entry.code] = typeof rate === "number" && first > 0 ? (rate / first) * 100 : null;
          row[`${entry.code}__rate`] = typeof rate === "number" ? rate : null;
        }
        return row;
      }),
      stats: summary,
    };
  }, [available, codes, days]);

  const toggle = (code: string) => {
    setCodes((current) => {
      if (current.includes(code)) return current.length === 1 ? current : current.filter((entry) => entry !== code);
      if (current.length >= MAX_PAIRS) return current;
      return [...current, code];
    });
  };

  const remaining = available.filter((entry) => !codes.includes(entry.code));
  const tick = { fontSize: 10, fill: "rgb(var(--muted-foreground))" } as const;

  if (available.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-muted-foreground">
        At least two fixings per pair are needed to compare performance.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {codes.map((code, index) => (
            <span
              key={code}
              className="inline-flex h-7 items-center gap-1.5 rounded-pill border border-border bg-elevated/60 pl-2 pr-1 text-[11px]"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: COLORS[index % COLORS.length] }}
                aria-hidden="true"
              />
              <span className="num">USD/{code}</span>
              {codes.length > 1 ? (
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Remove USD/${code} from the comparison`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              ) : null}
            </span>
          ))}

          {remaining.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={codes.length >= MAX_PAIRS}
                  className="inline-flex h-7 items-center gap-1 rounded-pill border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  Add pair
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-40 overflow-y-auto">
                <DropdownMenuLabel>Against USD</DropdownMenuLabel>
                {remaining.map((entry) => (
                  <DropdownMenuItem key={entry.code} onSelect={() => toggle(entry.code)} className="num">
                    USD/{entry.code}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Comparison window">
          {([30, 90] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={cn(
                "rounded-[7px] px-2 py-1 text-[10.5px] font-medium transition-colors",
                days === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      <div
        className="min-w-0"
        style={{ height: 224 }}
        role="img"
        aria-label={`Indexed performance of ${codes.map((code) => `USD/${code}`).join(", ")} over ${days} days, rebased to 100 at the first fixing.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              width={44}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <Tooltip
              cursor={{ stroke: "rgb(var(--muted-foreground))", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="min-w-[176px] rounded-tile border border-border bg-card/95 p-2.5 text-[11px] shadow-lift backdrop-blur">
                    <p className="label-xs">{formatDate(String(label))}</p>
                    <ul className="mt-1.5 space-y-1">
                      {payload.map((entry) => {
                        const code = String(entry.dataKey);
                        const indexed = typeof entry.value === "number" ? entry.value : null;
                        const rate = entry.payload?.[`${code}__rate`];
                        return (
                          <li key={code} className="flex items-center justify-between gap-2.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-1.5 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
                              USD/{code}
                            </span>
                            <span className="num text-right">
                              <span className="font-medium">{indexed === null ? "—" : indexed.toFixed(2)}</span>
                              {typeof rate === "number" ? (
                                <span className="ml-1.5 text-[10px] text-muted-foreground">
                                  {rate.toFixed(4)}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
                      Index · 100 = first fixing in the {days}-day window
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={100} stroke="rgb(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.45} />
            {codes.map((code, index) => (
              <Line
                key={code}
                type="monotone"
                dataKey={code}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, stroke: "rgb(var(--card))" }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-2.5">
        {stats.map((stat, index) => (
          <li key={stat.code} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} aria-hidden="true" />
            <span className="num">USD/{stat.code}</span>
            <span
              className={cn(
                "num font-medium",
                stat.change === null ? "text-muted-foreground" : stat.change > 0 ? "text-risk-low" : "text-risk-high",
              )}
            >
              {stat.change === null ? "—" : `${stat.change > 0 ? "+" : ""}${stat.change.toFixed(2)}%`}
            </span>
          </li>
        ))}
        <li className="ml-auto text-[10px] text-muted-foreground/80">Indexed to 100 · {days}-day window</li>
      </ul>
    </div>
  );
}
