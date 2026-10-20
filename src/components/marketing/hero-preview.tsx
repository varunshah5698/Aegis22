"use client";

import * as React from "react";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

import { CountUp } from "@/components/marketing/count-up";
import { RiskBadge } from "@/components/risk-badge";
import { demoTransactions, heroKpis, type DemoTransaction } from "@/content/demo";
import { cn } from "@/lib/utils";

const spark = [18, 22, 19, 26, 24, 31, 28, 35, 33, 38, 34, 41, 39, 45, 43, 49, 47, 52, 50, 56, 54, 59, 57, 62];

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / Math.max(1, max - min)) * 26;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HeroPreview() {
  const [rows, setRows] = React.useState<DemoTransaction[]>(demoTransactions.slice(0, 5));
  const cursor = React.useRef(5);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const row = demoTransactions[cursor.current % demoTransactions.length]!;
      cursor.current += 1;
      setRows((current) => [row, ...current].slice(0, 6));
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-hero border-2 border-foreground/15 bg-card shadow-lift">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-2.5 items-center justify-center">
            <span className="absolute size-2.5 animate-ping rounded-full bg-risk-low/60 motion-reduce:hidden" />
            <span className="size-2 rounded-full bg-risk-low" />
          </span>
          <p className="font-display text-sm font-semibold tracking-tight">Live monitoring</p>
          <span className="rounded-pill bg-muted px-2 py-0.5 text-[10px] tracking-wider text-muted-foreground">
            Northwind Payments
          </span>
        </div>
        <span className="num text-xs text-muted-foreground">2 min ago</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border p-4">
        {heroKpis.map((kpi) => (
          <div key={kpi.label} className="rounded-card border border-border bg-background/60 p-3">
            <p className="text-[11px] leading-tight text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 font-display text-xl font-semibold tracking-tight">
              <CountUp value={kpi.value} suffix={kpi.suffix ?? ""} />
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px]">
              {kpi.direction === "up" ? (
                <ArrowUpRight className={cn("size-3", kpi.negative ? "text-risk-high" : "text-risk-low")} aria-hidden="true" />
              ) : (
                <ArrowDownRight className="size-3 text-risk-low" aria-hidden="true" />
              )}
              <span className={cn("num", kpi.negative ? "text-risk-high" : "text-risk-low")}>
                {kpi.delta.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs. prev.</span>
            </div>
            <div className="mt-2 text-accent-foreground/40 dark:text-accent/60">
              <Sparkline values={spark.map((value) => value + kpi.label.length)} />
            </div>
          </div>
        ))}
      </div>

      <div className="max-h-[280px] overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[22%]" />
            <col />
            <col className="w-[28%]" />
            <col className="w-[24%]" />
          </colgroup>
          <caption className="sr-only">Latest scored transactions from the demo organization</caption>
          <thead>
            <tr className="text-[11.5px] text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">Time</th>
              <th scope="col" className="px-2 py-2 font-medium">Corridor</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.id}-${index}`}
                className={cn(
                  "border-t border-border/70 text-xs transition-colors",
                  index === 0 && "animate-flash motion-reduce:animate-none",
                )}
              >
                <td className="whitespace-nowrap px-4 py-2 num text-muted-foreground">{row.time}</td>
                <td className="px-2 py-2">
                  <span className="num text-foreground">{row.corridor}</span>
                  <span className="ml-2 hidden truncate text-muted-foreground sm:inline">{row.sender}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right num">
                  {row.amount.toLocaleString("en-US")} {row.currency}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="num text-[11px] text-muted-foreground">{row.score}</span>
                    <RiskBadge level={row.level} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="size-3.5" aria-hidden="true" />
          Scoring in real time
        </span>
        <span className="num">model v1 · 186 ms median</span>
      </div>
    </div>
  );
}
