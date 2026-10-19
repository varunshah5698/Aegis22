"use client";

import * as React from "react";

import { AlertBreakdown, RiskHistogram, VolumeAreaChart } from "@/components/dashboard/charts";
import { ALERT_CUTOFF, type RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

export function VolumePanel({
  series,
  height = 260,
}: {
  series: Array<{ label: string; count: number; value: number }>;
  height?: number;
}) {
  const [unit, setUnit] = React.useState<"count" | "value">("count");

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex items-center rounded-[7px] border border-border bg-muted/40 p-0.5" role="group" aria-label="Series">
          {(["count", "value"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              onClick={() => setUnit(option)}
              className={cn(
                "rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors",
                unit === option
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "count" ? "Count" : "Value"}
            </button>
          ))}
        </div>
      </div>
      <VolumeAreaChart data={series} unit={unit} height={height} />
    </div>
  );
}

export function DistributionPanel({
  bins,
}: {
  bins: Array<{ bin: string; low: number; high: number; count: number; level: RiskLevel }>;
}) {
  return <RiskHistogram bins={bins} threshold={ALERT_CUTOFF} />;
}

export function StatusPanel({ data, total }: { data: Array<{ status: string; count: number }>; total: number }) {
  return <AlertBreakdown data={data} total={total} />;
}
