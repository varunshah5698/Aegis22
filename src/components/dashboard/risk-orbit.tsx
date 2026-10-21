import type { WorkspaceAnalytics } from "@/lib/data/analytics";
import { RISK_COLORS, type RiskLevel } from "@/config/risk";
import { cn, formatCompactNumber } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Risk orbit — the window's composition as a lit satellite system             */
/* -------------------------------------------------------------------------- */

const CX = 240;
const CY = 158;
const RX = 176;
const RY = 110;
const CORE = 50;
const NODE = 26;

const BAND_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

/** Four fixed seats on the ellipse so the constellation never reflows. */
const SEAT: Record<RiskLevel, number> = {
  critical: -90,
  high: -18,
  medium: 66,
  low: 166,
};

function seat(level: RiskLevel) {
  const rad = (SEAT[level] * Math.PI) / 180;
  return {
    x: Math.round((CX + RX * Math.cos(rad)) * 10) / 10,
    y: Math.round((CY + RY * Math.sin(rad)) * 10) / 10,
  };
}

/**
 * The overview's hero graphic: the scored total sits in a glowing core and
 * each risk band orbits it as a satellite — the connector is tinted from the
 * core's violet into the band's own colour, the seat carries the band's share,
 * and the legend under the orbit keeps the raw counts. Drawn as one SVG with
 * two blur filters, so the light is real blur rather than a CSS halo.
 */
export function RiskOrbit({
  mix,
  total,
  className,
}: {
  mix: WorkspaceAnalytics["riskMix"];
  total: number;
  className?: string;
}) {
  const byLevel = new Map(mix.map((entry) => [entry.level, entry]));
  const ariaLabel = [
    `Score composition: ${formatCompactNumber(total)} scored payments.`,
    ...BAND_ORDER.map((level) => {
      const entry = byLevel.get(level);
      return `${level} ${entry?.count ?? 0} payments, ${entry?.share ?? 0} percent`;
    }),
  ].join(", ");

  return (
    <div className={cn("w-full max-w-[440px] min-w-0", className)}>
      <svg
        viewBox="0 0 480 320"
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <filter id="orbit-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="orbit-core" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="orbit-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.34" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </radialGradient>
          {BAND_ORDER.map((level) => {
            const { x, y } = seat(level);
            return (
              <linearGradient
                key={level}
                id={`orbit-line-${level}`}
                gradientUnits="userSpaceOnUse"
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
              >
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.12" />
                <stop offset="100%" stopColor={RISK_COLORS[level]} stopOpacity="0.8" />
              </linearGradient>
            );
          })}
        </defs>

        {/* orbit paths: an outer constellation ring, a faint inner one, and a
            slowly counter-rotating dashed ring around the core */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth="1"
          strokeDasharray="3 7"
        />
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX * 0.58}
          ry={RY * 0.58}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth="1"
          strokeDasharray="2 9"
          opacity="0.55"
        />
        <circle
          cx={CX}
          cy={CY}
          r="94"
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="1"
          strokeDasharray="2 12"
          opacity="0.5"
          className="orbit-spin"
        />

        {/* connectors: violet at the core, the band's own colour at the seat */}
        {BAND_ORDER.map((level) => {
          const { x, y } = seat(level);
          const dx = x - CX;
          const dy = y - CY;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          return (
            <line
              key={level}
              x1={Math.round((CX + ux * (CORE + 6)) * 10) / 10}
              y1={Math.round((CY + uy * (CORE + 6)) * 10) / 10}
              x2={Math.round((x - ux * (NODE + 5)) * 10) / 10}
              y2={Math.round((y - uy * (NODE + 5)) * 10) / 10}
              stroke={`url(#orbit-line-${level})`}
              strokeWidth="1.4"
              filter="url(#orbit-glow)"
            />
          );
        })}

        {/* satellite seats: the band's share inside, its name outside */}
        {BAND_ORDER.map((level) => {
          const { x, y } = seat(level);
          const entry = byLevel.get(level);
          const share = entry?.share ?? 0;
          const name = level.charAt(0).toUpperCase() + level.slice(1);
          const nameY = level === "critical" ? y - 34 : y + 42;
          return (
            <g key={level}>
              <g filter="url(#orbit-glow)">
                <circle
                  cx={x}
                  cy={y}
                  r={NODE}
                  fill="rgb(var(--card))"
                  stroke={RISK_COLORS[level]}
                  strokeWidth="1.6"
                />
                <text
                  x={x}
                  y={y + 4.5}
                  textAnchor="middle"
                  className="num"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    fill: RISK_COLORS[level],
                  }}
                >
                  {share.toFixed(1)}%
                </text>
              </g>
              <text
                x={x}
                y={nameY}
                textAnchor="middle"
                style={{
                  fontSize: 11,
                  fill: "rgb(var(--muted-foreground))",
                }}
              >
                {name}
              </text>
            </g>
          );
        })}

        {/* core: the scored total in a violet-lit ring */}
        <circle cx={CX} cy={CY} r="66" fill="url(#orbit-halo)" />
        <g filter="url(#orbit-core)">
          <circle
            cx={CX}
            cy={CY}
            r={CORE}
            fill="rgb(var(--elevated))"
            stroke="rgb(var(--accent))"
            strokeWidth="1.5"
          />
        </g>
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          className="num"
          style={{
            fontSize: 23,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            fill: "rgb(var(--foreground))",
          }}
        >
          {formatCompactNumber(total)}
        </text>
        <text
          x={CX}
          y={CY + 17}
          textAnchor="middle"
          style={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
        >
          scored
        </text>
      </svg>
    </div>
  );
}
