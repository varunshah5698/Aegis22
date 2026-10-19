"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EntityFlowBucket } from "@/lib/data/entity";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";

const axisStyle = { fontSize: 10, fill: "rgb(var(--muted-foreground))" } as const;

const tooltipStyle = {
  background: "rgb(var(--card))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 10,
  fontSize: 11,
  color: "rgb(var(--foreground))",
  boxShadow: "0 12px 32px rgb(0 0 0 / 0.22)",
} as const;

/**
 * Directional flow: inbound and outbound value stack per bucket, with the
 * transfer count overlaid as a line so a quiet month and a busy month are not
 * confused just because the values happen to match.
 */
export function EntityFlowChart({ flow, height = 250 }: { flow: EntityFlowBucket[]; height?: number }) {
  return (
    <div>
      <div
        style={{ height }}
        role="img"
        aria-label="Inbound and outbound value per bucket, with transfer count overlaid."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={flow} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.7} vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={28} dy={6} />
            <YAxis
              yAxisId="value"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={46}
              tickCount={5}
              tickFormatter={(value: number) => formatCompactNumber(value)}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={28}
              tickCount={4}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgb(var(--muted) / 0.45)" }}
              contentStyle={tooltipStyle}
              formatter={(value: number, name) =>
                name === "count"
                  ? [value, "Transfers"]
                  : [formatCurrency(value, "USD", { maximumFractionDigits: 0 }), name === "inValue" ? "Inbound" : "Outbound"]
              }
            />
            <Bar yAxisId="value" dataKey="inValue" name="inValue" stackId="flow" fill="#2DD4BF" fillOpacity={0.55} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="value" dataKey="outValue" name="outValue" stackId="flow" fill="#F0B250" fillOpacity={0.62} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              stroke="rgb(var(--foreground))"
              strokeOpacity={0.55}
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[#2DD4BF]/70" aria-hidden="true" /> Inbound value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[#F0B250]/80" aria-hidden="true" /> Outbound value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 bg-foreground/50" aria-hidden="true" /> Transfers
        </span>
        <span className="ml-auto">USD base value · UTC buckets</span>
      </div>
    </div>
  );
}
