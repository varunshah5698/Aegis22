import { RISK_COLORS, type RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

export interface ScoreBand {
  bin: string;
  low: number;
  high: number;
  count: number;
  level: RiskLevel;
  share: number;
}

const levelLabels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * Score distribution drawn directly in score space: ten columns from 0 to 99,
 * each sized by how many payments landed in that band. The alert cutoff is a
 * real position on the axis rather than a caption, so reviewers can see how
 * much volume sits just under the line.
 */
export function ScoreBands({
  bins,
  threshold,
  height = 188,
  className,
}: {
  bins: ScoreBand[];
  threshold: number;
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  const gridLines = [1, 0.75, 0.5, 0.25, 0];
  const cutoffPosition = Math.min(100, Math.max(0, threshold));

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0" aria-hidden="true">
          {gridLines.map((ratio) => (
            <div
              key={ratio}
              className="absolute inset-x-0 border-t border-dashed border-border/60"
              style={{ bottom: `${ratio * 100}%` }}
            />
          ))}
        </div>

        <div className="absolute bottom-0 top-0 grid grid-cols-10 items-end gap-1.5" aria-hidden="true">
          {bins.map((bin) => {
            const below = bin.high < threshold;
            const columnHeight = bin.count > 0 ? Math.max(3, (bin.count / max) * 92) : 0;
            return (
              <div key={bin.bin} className="relative flex h-full flex-col items-center justify-end">
                {bin.count > 0 ? (
                  <span
                    className={cn(
                      "num mb-1 text-[10px] leading-3",
                      bin.high >= threshold ? "text-foreground" : "text-muted-foreground",
                    )}
                    title={`${bin.count} payments scored ${bin.low}–${bin.high}`}
                  >
                    {bin.count}
                  </span>
                ) : null}
                <div
                  className="w-full rounded-t-[5px] transition-opacity"
                  style={{
                    height: `${columnHeight}%`,
                    background: `linear-gradient(180deg, ${RISK_COLORS[bin.level]} 0%, ${RISK_COLORS[bin.level]}55 100%)`,
                    opacity: below ? 0.5 : 1,
                  }}
                  title={`${bin.count} payments scored ${bin.low}–${bin.high} (${bin.share.toFixed(1)}%)`}
                />
              </div>
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-foreground/45"
          style={{ left: `${cutoffPosition}%` }}
          aria-hidden="true"
        >
          <span className="absolute -top-1 left-1 whitespace-nowrap rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-border">
            Cutoff {threshold}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-10 gap-1.5 text-[10px] text-muted-foreground">
        {bins.map((bin) => (
          <span key={bin.bin} className="num text-center">
            {bin.low}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {(["low", "medium", "high", "critical"] as RiskLevel[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-sm" style={{ background: RISK_COLORS[level] }} aria-hidden="true" />
              {levelLabels[level]}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Bands left of the cutoff stay monitoring-only; bars to the right raise an alert.
        </p>
      </div>
    </div>
  );
}
