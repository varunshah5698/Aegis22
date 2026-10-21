import { RISK_COLORS, type RiskLevel } from "@/config/risk";

/* -------------------------------------------------------------------------- */
/* Auth constellation — the rail's glowing corridor network                    */
/* -------------------------------------------------------------------------- */

/**
 * The login rail's hero graphic, in the workspace's own language: a payment
 * network drawn as a constellation. Three corridor seats glow with their risk
 * colour (the routes an analyst signed up to catch), the rest of the mesh sits
 * quiet in hairline violet, one pulse travels the lit route through them, and
 * a dashed ring ticks around the field once a minute. All light is real SVG
 * blur; reduced motion parks the ring and hides the pulse.
 */

const NODES = {
  d1: { x: 92, y: 132 },
  d2: { x: 256, y: 52 },
  d3: { x: 330, y: 60 },
  d4: { x: 516, y: 158 },
  d5: { x: 74, y: 330 },
  d6: { x: 246, y: 392 },
  d7: { x: 470, y: 380 },
  m1: { x: 238, y: 130 },
  m2: { x: 474, y: 264 },
  crit: { x: 418, y: 116, level: "critical" as RiskLevel, label: "AE → IR" },
  med: { x: 168, y: 286, level: "medium" as RiskLevel, label: "PK → MM" },
  low: { x: 342, y: 322, level: "low" as RiskLevel, label: "US → BR" },
} satisfies Record<string, { x: number; y: number; level?: RiskLevel; label?: string }>;

type NodeKey = keyof typeof NODES;

const DIM_EDGES: Array<[NodeKey, NodeKey]> = [
  ["d1", "m1"],
  ["d1", "med"],
  ["d1", "d5"],
  ["m1", "d2"],
  ["m1", "d3"],
  ["m1", "med"],
  ["d2", "crit"],
  ["d3", "crit"],
  ["crit", "d4"],
  ["crit", "m2"],
  ["m2", "d4"],
  ["m2", "d7"],
  ["m2", "low"],
  ["med", "low"],
  ["med", "d5"],
  ["low", "d6"],
  ["low", "d7"],
  ["d5", "d6"],
];

/** The one route the pulse travels: three lit seats in sequence. */
const LIT_EDGES: Array<[NodeKey, NodeKey]> = [
  ["m1", "crit"],
  ["crit", "m2"],
  ["m2", "low"],
];

const PULSE_PATH = [
  `M ${NODES.m1.x} ${NODES.m1.y}`,
  `L ${NODES.crit.x} ${NODES.crit.y}`,
  `L ${NODES.m2.x} ${NODES.m2.y}`,
  `L ${NODES.low.x} ${NODES.low.y}`,
].join(" ");

const line = (a: NodeKey, b: NodeKey) => {
  const from = NODES[a];
  const to = NODES[b];
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
};

const HERO_KEYS: NodeKey[] = ["crit", "med", "low"];

export function AuthConstellation({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 560 420"
        className="h-auto w-full"
        role="img"
        aria-label="Corridor constellation: AE to IR, PK to MM and US to BR glowing as live routes across a monitored payment network."
      >
        <defs>
          <filter id="auth-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="3.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="auth-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.16" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* violet light source behind the mesh */}
        <ellipse cx="300" cy="210" rx="280" ry="210" fill="url(#auth-bloom)" />

        {/* tick ring, one slow turn every 46s */}
        <circle
          cx="300"
          cy="210"
          r="178"
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="1"
          strokeDasharray="2 12"
          opacity="0.4"
          className="auth-orbit"
        />
        <circle
          cx="300"
          cy="210"
          r="116"
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth="1"
          strokeDasharray="3 10"
          opacity="0.5"
        />

        {/* quiet mesh */}
        {DIM_EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            {...line(a, b)}
            stroke="rgb(var(--border))"
            strokeWidth="1"
            opacity="0.85"
          />
        ))}

        {/* the lit route: violet, glowing, carrying the pulse */}
        {LIT_EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            {...line(a, b)}
            stroke="rgb(var(--accent))"
            strokeWidth="1.6"
            opacity="0.65"
            filter="url(#auth-glow)"
          />
        ))}

        {/* dim monitored nodes */}
        {(["d1", "d2", "d3", "d4", "d5", "d6", "d7", "m1", "m2"] as const).map((key) => {
          const node = NODES[key];
          const isMid = key === "m1" || key === "m2";
          return (
            <g key={key} filter={isMid ? "url(#auth-glow)" : undefined}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isMid ? 10 : 5.5}
                fill={isMid ? "rgb(var(--card))" : "rgb(var(--elevated))"}
                stroke={isMid ? "rgb(var(--accent))" : "rgb(var(--border-strong))"}
                strokeWidth={isMid ? 1.4 : 1}
              />
              {isMid ? <circle cx={node.x} cy={node.y} r="3.5" fill="rgb(var(--accent))" /> : null}
            </g>
          );
        })}

        {/* hero seats: risk-ringed corridors with their route labels */}
        {HERO_KEYS.map((key) => {
          const node = NODES[key] as { x: number; y: number; level: RiskLevel; label: string };
          const color = RISK_COLORS[node.level];
          return (
            <g key={key}>
              <circle
                cx={node.x}
                cy={node.y}
                r="25"
                fill="none"
                stroke={color}
                strokeWidth="1"
                opacity="0.25"
              />
              <g filter="url(#auth-glow)">
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="17"
                  fill="rgb(var(--card))"
                  stroke={color}
                  strokeWidth="2"
                />
                <circle cx={node.x} cy={node.y} r="6" fill={color} />
              </g>
              <text
                x={node.x}
                y={node.y + 38}
                textAnchor="middle"
                className="num"
                style={{ fontSize: 11, letterSpacing: "0.04em", fill: "rgb(var(--muted-foreground))" }}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* one travelling pulse along the lit route */}
        <circle r="4" fill="#22D3EE" className="flow-pulse" filter="url(#auth-glow)">
          <animateMotion dur="6s" repeatCount="indefinite" path={PULSE_PATH} />
        </circle>
      </svg>
    </div>
  );
}
