"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { RISK_COLORS, type RiskLevel } from "@/config/risk";
import { cn, formatCompactNumber } from "@/lib/utils";

const labels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * Risk mix as a ring: the centre states the flagged share, the ring shows the
 * band split and the list underneath carries the counts and value so the chart
 * is never the only way to read the number.
 */
export function RiskMixDonut({
  mix,
  total,
  flagged,
  flaggedShare,
  height = 196,
  className,
}: {
  mix: Array<{ level: RiskLevel; count: number; value: number; share: number }>;
  total: number;
  flagged: number;
  flaggedShare: number;
  height?: number;
  className?: string;
}) {
  const data = mix.filter((entry) => entry.count > 0);

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div
          className="relative shrink-0"
          style={{ width: height, height }}
          role="img"
          aria-label={`${total} scored, ${flagged} flagged, ${flaggedShare.toFixed(1)}% of volume`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="level"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                cornerRadius={3}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.level} fill={RISK_COLORS[entry.level]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="num text-[21px] font-medium leading-6 tracking-[-0.03em]">
              {formatCompactNumber(total)}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">scored</span>
            <span className={cn("num mt-1 text-[10.5px] leading-4", flagged > 0 ? "text-risk-high" : "text-risk-low")}>
              {flagged} flagged
            </span>
          </div>
        </div>

        <ul className="w-full space-y-2.5">
          {mix.map((entry) => (
            <li key={entry.level} className="flex items-center gap-2.5">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: RISK_COLORS[entry.level] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{labels[entry.level]}</span>
              <span className="num text-[12.5px] font-medium">{entry.count.toLocaleString("en-US")}</span>
              <span className="num w-11 text-right text-[11px] text-muted-foreground">{entry.share.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
