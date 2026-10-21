import type { SeriesBucket, WorkspaceAnalytics } from "@/lib/data/analytics";
import { RISK_COLORS, SCORE_BANDS, type RiskLevel } from "@/config/risk";
import { cn, formatCompactNumber } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Scored radar — concentric arcs for the window's risk mix                    */
/* -------------------------------------------------------------------------- */

const BAND_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

/**
 * A radial read of the window: four concentric arcs, one per risk band, each
 * swept by that band's share of scored payments. It answers "how hot is this
 * window" in a single shape. The centre carries one figure only — a ring hole
 * this size cannot hold a stacked readout without crowding the innermost arc,
 * so the scored and flagged counts live in the panel header beside it.
 */
export function ScoredRadar({
  mix,
  total,
  className,
}: {
  mix: WorkspaceAnalytics["riskMix"];
  total: number;
  className?: string;
}) {
  const size = 208;
  const cx = size / 2;
  const cy = size / 2;
  // Inner radius leaves a clean hole for the single centre figure.
  const rings = [94, 74, 54, 34];
  const byLevel = new Map(mix.map((entry) => [entry.level, entry]));

  const arc = (radius: number, share: number) => {
    const start = -Math.PI / 2;
    const end = start + share * Math.PI * 2;
    if (share >= 0.999) {
      // Full circle: two arcs, since a single arc can't span 360°.
      const mid = start + Math.PI;
      return [
        `M ${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)}`,
        `A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(mid)} ${cy + radius * Math.sin(mid)}`,
        `A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)}`,
      ].join(" ");
    }
    const large = share > 0.5 ? 1 : 0;
    return [
      `M ${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)}`,
      `A ${radius} ${radius} 0 ${large} 1 ${cx + radius * Math.cos(end)} ${cy + radius * Math.sin(end)}`,
    ].join(" ");
  };

  return (
    <div className={cn("radar", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" aria-hidden="true">
        {BAND_ORDER.map((level, index) => {
          const share = (byLevel.get(level)?.share ?? 0) / 100;
          const radius = rings[index]!;
          return (
            <g key={level}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgb(var(--muted))" strokeWidth={13} opacity={0.5} />
              {share > 0 ? (
                <path
                  d={arc(radius, share)}
                  fill="none"
                  stroke={RISK_COLORS[level]}
                  strokeWidth={13}
                  strokeLinecap="round"
                  opacity={0.92}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="radar__center">
        <span className="num text-[26px] font-semibold leading-7 tracking-[-0.03em] text-foreground">
          {formatCompactNumber(total)}
        </span>
        <span className="text-[11px] leading-4 text-muted-foreground">scored</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Score distribution — a soft area curve over the 0–100 histogram             */
/* -------------------------------------------------------------------------- */

/**
 * The window's score histogram drawn as a filled area with a marker at the
 * alert cutoff. Where the mass sits relative to the cutoff is the whole
 * question a risk analyst asks, so the cutoff is drawn, not implied.
 */
export function ScoreDistribution({
  distribution,
  avgScore,
  medianScore,
  p90,
  className,
}: {
  distribution: WorkspaceAnalytics["distribution"];
  avgScore: number;
  medianScore: number;
  p90: number;
  className?: string;
}) {
  const width = 320;
  const height = 92;
  const max = Math.max(1, ...distribution.map((bin) => bin.count));
  const step = width / distribution.length;

  const points = distribution.map((bin, index) => ({
    x: index * step + step / 2,
    y: height - (bin.count / max) * (height - 12),
    count: bin.count,
  }));

  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const cutoffX = (SCORE_BANDS.alert / 100) * width;

  return (
    <div className={cn("min-w-0", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[92px] w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dist-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.32" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} className="dist-area" />
        <polyline
          points={line}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={cutoffX}
          y1={0}
          x2={cutoffX}
          y2={height}
          stroke="rgb(var(--risk-high))"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
        <ReadoutStat label="Average" value={avgScore.toFixed(1)} />
        <ReadoutStat label="Median" value={String(medianScore)} />
        <ReadoutStat label="p90" value={String(p90)} />
      </div>
      <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">
        Dashed line is the alert cutoff at {SCORE_BANDS.alert}. Mass to its right is what raises alerts.
      </p>
    </div>
  );
}

function ReadoutStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] leading-4 text-muted-foreground">{label}</p>
      <p className="num text-[15px] font-semibold leading-5 tracking-[-0.02em] text-foreground">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Window trend — screened vs flagged value over the selected window           */
/* -------------------------------------------------------------------------- */

/**
 * A column chart of the selected window's daily (or hourly) value, with the
 * flagged portion stacked in the risk colour. A 7-day window and a 90-day
 * window share the same shape because both are drawn from the same series.
 */
export function WindowTrend({ series, className }: { series: SeriesBucket[]; className?: string }) {
  const max = Math.max(1, ...series.map((point) => point.value));
  const tickShares = [1, 0.5, 0];

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex gap-2">
        <div
          className="flex w-9 shrink-0 flex-col justify-between text-right text-[10px] leading-3 text-muted-foreground"
          style={{ height: 132 }}
        >
          {tickShares.map((share) => (
            <span key={share} className="num">
              {share === 0 ? "0" : `$${formatCompactNumber(Math.round(max * share))}`}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: 132 }}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {tickShares.map((share) => (
                <div key={share} className="h-px w-full bg-border/60" />
              ))}
            </div>
            <div className="relative flex h-full items-end gap-[2px]">
              {series.map((point) => {
                const total = (point.value / max) * 100;
                const flagged = point.value > 0 ? (point.flaggedValue / point.value) * total : 0;
                return (
                  <div
                    key={point.at}
                    className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${point.label}: $${formatCompactNumber(point.value)} screened · ${point.flagged} flagged`}
                  >
                    <div
                      className="w-full rounded-t-[3px] bg-risk-critical/85 transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(0, flagged)}%` }}
                    />
                    <div
                      className="w-full rounded-b-[3px] bg-[rgb(var(--accent))] transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(point.value > 0 ? 2 : 0, total - flagged)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[10px] leading-4 text-muted-foreground">
            <span>{series[0]?.label}</span>
            <span>{series[series.length - 1]?.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Readout rail — a labelled figure with a proportional track                  */
/* -------------------------------------------------------------------------- */

export function ReadoutRail({
  items,
  className,
}: {
  items: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
    share: number;
    color?: string;
    foot?: React.ReactNode;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {items.map((item) => (
        <div key={item.key} className="readout">
          <div className="readout__label">
            <span>{item.label}</span>
            {item.foot ? <span className="num">{item.foot}</span> : null}
          </div>
          <p className="readout__value">{item.value}</p>
          <div className="readout__track">
            <div
              className="readout__fill"
              style={{
                width: `${Math.max(2, Math.min(100, item.share * 100))}%`,
                background: item.color ?? "rgb(var(--accent))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
