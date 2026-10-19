"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / Math.max(1, max - min)) * 24;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className={cn("h-7 w-full", className)} aria-hidden="true" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CountUp({ value, decimals = 0, suffix = "", prefix = "" }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      setDisplay(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span ref={ref} className="num">
      {prefix}
      {display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  format?: "number" | "score" | "ms";
  delta?: number;
  /** A rise is bad for this metric (for example, flagged transactions). */
  invert?: boolean;
  spark?: number[];
  hint?: string;
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const delta = item.delta ?? 0;
        const rising = delta > 0.05;
        const falling = delta < -0.05;
        const good = item.invert ? falling : rising;
        const tone = !rising && !falling ? "text-muted-foreground" : good ? "text-risk-low" : "text-risk-high";

        return (
          <div key={item.id} className="min-w-0 rounded-card border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight">
              <CountUp
                value={item.value}
                decimals={item.format === "score" ? 1 : 0}
                suffix={item.format === "ms" ? " ms" : ""}
              />
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px]">
              {!rising && !falling ? (
                <Minus className="size-3 text-muted-foreground" aria-hidden="true" />
              ) : rising ? (
                <ArrowUpRight className={cn("size-3", tone)} aria-hidden="true" />
              ) : (
                <ArrowDownRight className={cn("size-3", tone)} aria-hidden="true" />
              )}
              {typeof item.delta === "number" ? (
                <span className={cn("num", tone)}>{Math.abs(delta).toFixed(1)}%</span>
              ) : null}
              <span className="text-muted-foreground">{item.hint ?? "vs. previous period"}</span>
            </div>
            {item.spark ? (
              <div className="mt-2 text-foreground/25">
                <Sparkline values={item.spark} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
