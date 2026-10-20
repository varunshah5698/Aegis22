import { RISK_COLORS, SCORE_BANDS, scoreToLevel } from "@/config/risk";
import { Sparkline } from "@/components/app/page-shell";
import { cn, formatCompactNumber } from "@/lib/utils";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function heatColor(score: number): string {
  const level = scoreToLevel(score);
  const base = RISK_COLORS[level];
  const alpha = score <= 0 ? 0.1 : Math.min(0.9, 0.18 + (Math.min(100, score) / 100) * 0.72);
  return `${base}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Corridor exposure over the selected window. Each cell carries the average
 * score for that corridor in that period, coloured by risk level, so a
 * corridor heating up over consecutive days is obvious at a glance.
 */
export function CorridorHeatGrid({
  matrix,
  className,
}: {
  matrix: {
    bucketLabels: string[];
    rows: Array<{
      corridor: string;
      senderCountry: string;
      receiverCountry: string;
      cells: Array<number | null>;
      value: number;
    }>;
  };
  className?: string;
}) {
  if (matrix.rows.length === 0) {
    return <p className="py-8 text-center text-[12px] text-muted-foreground">No corridor activity in this window.</p>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-[560px]">
        <div className="flex items-center gap-2 pb-1.5">
          <span className="w-[74px] shrink-0" aria-hidden="true" />
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${matrix.bucketLabels.length}, minmax(0, 1fr))` }}>
            {matrix.bucketLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="truncate text-center text-[10px] text-muted-foreground"
                title={label}
              >
                {index % 2 === 0 || matrix.bucketLabels.length <= 8 ? label : ""}
              </span>
            ))}
          </div>
          <span className="w-[86px] shrink-0 text-right text-[11.5px] text-muted-foreground">
            Trend
          </span>
        </div>

        <ul className="space-y-1">
          {matrix.rows.map((row) => (
            <li key={row.corridor} className="flex items-center gap-2">
              <span className="num w-[74px] shrink-0 truncate text-[11.5px] text-foreground/90" title={`${row.senderCountry} → ${row.receiverCountry}`}>
                {row.corridor}
              </span>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${matrix.bucketLabels.length}, minmax(0, 1fr))` }}>
                {row.cells.map((cell, index) => (
                  <span
                    key={`${row.corridor}-${index}`}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-[5px] text-[10.5px] font-medium",
                      cell === null ? "bg-muted/40 text-muted-foreground/40" : "text-foreground/90",
                    )}
                    style={cell === null ? undefined : { background: heatColor(cell) }}
                    title={
                      cell === null
                        ? `${row.corridor} · ${matrix.bucketLabels[index]}: no payments`
                        : `${row.corridor} · ${matrix.bucketLabels[index]}: avg score ${cell}`
                    }
                  >
                    {matrix.bucketLabels.length <= 12 && cell !== null ? cell : ""}
                  </span>
                ))}
              </div>
              <span className="flex w-[86px] shrink-0 items-center justify-end gap-1.5 text-muted-foreground">
                <Sparkline
                  values={row.cells.map((cell) => cell ?? 0)}
                  className="h-5 w-12 text-accent/70"
                  fill={false}
                  strokeWidth={1.4}
                />
                <span className="num text-[10.5px]">{formatCompactNumber(row.value)}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <span className="text-[11px] text-muted-foreground">
            Cell colour is the average score that period; the alert cutoff sits at {SCORE_BANDS.alert}.
          </span>
          <span className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
            Score 0
            <span className="flex h-2 w-24 overflow-hidden rounded-full" aria-hidden="true">
              {[0, 20, 40, 60, 80, 100].map((score) => (
                <span key={score} className="h-full flex-1" style={{ background: heatColor(score) }} />
              ))}
            </span>
            100
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Weekday × hour board in UTC. Useful for spotting the cadence of laundering
 * patterns that cluster outside normal operating hours.
 */
export function HourBoard({
  counts,
  peak,
  className,
}: {
  counts: number[][];
  peak: { weekday: number; hour: number; count: number } | null;
  className?: string;
}) {
  const max = Math.max(1, ...counts.flat());

  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="flex items-center gap-2 pb-1.5">
            <span className="w-8 shrink-0" aria-hidden="true" />
            <div
              className="grid flex-1 gap-[3px]"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className="num text-center text-[9.5px] text-muted-foreground">
                  {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-[3px]">
            {counts.map((hours, weekday) => (
              <li key={weekday} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[10.5px] text-muted-foreground">{weekdayLabels[weekday]}</span>
                <div
                  className="grid flex-1 gap-[3px]"
                  style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                >
                  {hours.map((count, hour) => {
                    const intensity = count / max;
                    const isPeak = peak?.weekday === weekday && peak?.hour === hour;
                    return (
                      <span
                        key={hour}
                        className={cn(
                          "h-5 rounded-[4px]",
                          isPeak && "ring-1 ring-accent/70",
                        )}
                        style={{
                          background:
                            count === 0
                              ? "rgb(var(--muted) / 0.5)"
                              : `rgb(var(--accent) / ${(0.14 + intensity * 0.72).toFixed(2)})`,
                        }}
                        title={`${weekdayLabels[weekday]} ${String(hour).padStart(2, "0")}:00 UTC · ${count} payments`}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
            <span>Rows are UTC weekdays, columns are UTC hours.</span>
            {peak ? (
              <span className="num">
                Peak {weekdayLabels[peak.weekday]} {String(peak.hour).padStart(2, "0")}:00 · {peak.count} payments
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
