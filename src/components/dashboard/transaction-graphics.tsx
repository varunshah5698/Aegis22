import { RISK_COLORS, SCORE_BANDS, scoreToLevel, type RiskLevel } from "@/config/risk";
import { cn, formatCompactNumber } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Corridor flow — the payment's journey as one lit arc                        */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  settled: RISK_COLORS.low,
  pending: RISK_COLORS.medium,
  blocked: RISK_COLORS.critical,
  reversed: RISK_COLORS.high,
};

/**
 * The payment as a single arc from origin to destination. The arc carries the
 * payment's own risk colour and a travelling pulse; the figure at the apex is
 * the amount in its own currency with the USD base underneath, so the graphic
 * answers "what moved, where, and how hot is it" without a single table.
 */
export function CorridorFlow({
  senderCountry,
  receiverCountry,
  senderName,
  receiverName,
  amountLabel,
  amountBaseLabel,
  level,
  status,
  channel,
}: {
  senderCountry: string;
  receiverCountry: string;
  senderName: string;
  receiverName: string;
  amountLabel: string;
  amountBaseLabel: string;
  level: RiskLevel;
  status: string;
  channel: string;
}) {
  const color = STATUS_COLORS[status] ?? RISK_COLORS[level];
  const path = "M 58 132 C 200 26, 458 26, 600 132";
  const trunc = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value;

  return (
    <div className="min-w-0">
      <svg viewBox="0 0 658 172" className="h-auto w-full" role="img"
        aria-label={`${senderName} in ${senderCountry} sent ${amountLabel} to ${receiverName} in ${receiverCountry}. ${level} risk, status ${status}.`}
      >
        <defs>
          {/* one neon source for the arc halo, pulse, and endpoints */}
          <filter id="flow-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="flow-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* baseline the two endpoints sit on */}
        <line x1="58" y1="150" x2="600" y2="150" stroke="rgb(var(--border))" strokeWidth="1" />

        {/* bloom behind the apex figures, tinted by the payment's own colour */}
        <circle cx="329" cy="46" r="74" fill="url(#flow-halo)" />

        {/* soft halo arc, then the marching arc itself */}
        <path d={path} fill="none" stroke={color} strokeWidth="9" opacity="0.22" strokeLinecap="round" filter="url(#flow-glow)" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="10 9"
          className="flow-arc"
        />

        {/* travelling pulse */}
        <circle r="4.5" fill={color} className="flow-pulse" filter="url(#flow-glow)">
          <animateMotion dur="3.4s" repeatCount="indefinite" path={path} />
        </circle>

        {/* endpoints */}
        {[
          { x: 58, code: senderCountry, name: senderName },
          { x: 600, code: receiverCountry, name: receiverName },
        ].map((node) => (
          <g key={node.x}>
            <g filter="url(#flow-glow)">
              <circle cx={node.x} cy="132" r="13" fill="rgb(var(--card))" stroke={color} strokeWidth="1.5" opacity="0.9" />
              <circle cx={node.x} cy="132" r="5" fill={color} />
            </g>
            <text
              x={node.x}
              y="164"
              textAnchor="middle"
              className="num"
              style={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
            >
              {node.code} · {trunc(node.name, 20)}
            </text>
          </g>
        ))}

        {/* apex figures */}
        <text
          x="329"
          y="34"
          textAnchor="middle"
          className="num"
          style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", fill: "rgb(var(--foreground))" }}
        >
          {amountLabel}
        </text>
        <text
          x="329"
          y="82"
          textAnchor="middle"
          className="num"
          style={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
        >
          {amountBaseLabel} · {channel}
        </text>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Score build — a horizontal waterfall from signals to the published score    */
/* -------------------------------------------------------------------------- */

export interface BuildFactor {
  id: string;
  label: string;
  points: number;
  triggered: boolean;
}

/**
 * Each signal's points added left-to-right onto a running total, with the
 * alert cutoff drawn as a fixed line. Reading where the stack crosses the line
 * is the whole decision, so the crossing is visual rather than arithmetic.
 */
export function ScoreBuild({
  factors,
  published,
  maxRows = 7,
}: {
  factors: BuildFactor[];
  published: number;
  maxRows?: number;
}) {
  if (factors.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-muted-foreground">
        No signal contributions were recorded for this payment.
      </p>
    );
  }

  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const head = sorted.slice(0, maxRows);
  const rest = sorted.slice(maxRows);
  const rows = [
    ...head,
    ...(rest.length > 0
      ? [
          {
            id: "__other",
            label: `${rest.length} smaller signal${rest.length === 1 ? "" : "s"}`,
            points: rest.reduce((sum, factor) => sum + factor.points, 0),
            triggered: rest.some((factor) => factor.triggered),
          },
        ]
      : []),
  ];

  const x0 = 186;
  const width = 424;
  const rowH = 30;
  const topPad = 26;
  const height = topPad + rows.length * rowH + 34;
  const at = (points: number) => x0 + (Math.min(100, points) / 100) * width;
  const level = scoreToLevel(published);

  let cumulative = 0;
  const placed = rows.map((row) => {
    const start = cumulative;
    cumulative += row.points;
    return { row, start, end: cumulative };
  });

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 658 ${height}`} className="h-auto w-full" role="img"
        aria-label={`Signal contributions building to a published score of ${Math.round(published)}, cutoff ${SCORE_BANDS.alert}`}
      >
        {/* cutoff line */}
        <line
          x1={at(SCORE_BANDS.alert)}
          y1="10"
          x2={at(SCORE_BANDS.alert)}
          y2={height - 26}
          stroke="rgb(var(--risk-high))"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text
          x={at(SCORE_BANDS.alert) + 5}
          y="17"
          className="num"
          style={{ fontSize: 11.5, fill: "rgb(var(--risk-high))" }}
        >
          alert {SCORE_BANDS.alert}
        </text>

        {placed.map(({ row, start, end }, index) => {
          const y = topPad + index * rowH;
          const left = at(start);
          const barWidth = Math.max(2, at(end) - at(start));
          return (
            <g key={row.id}>
              <text
                x="176"
                y={y + 12}
                textAnchor="end"
                style={{ fontSize: 11, fill: "rgb(var(--foreground))" }}
              >
                {row.label.length > 28 ? `${row.label.slice(0, 27)}…` : row.label}
              </text>
              {/* ghost track shows how much room is left to 100 */}
              <rect x={x0} y={y + 3} width={width} height="14" rx="4" fill="rgb(var(--muted))" opacity="0.45" />
              <rect
                x={left}
                y={y + 3}
                width={barWidth}
                height="14"
                rx="4"
                fill={row.triggered ? RISK_COLORS.high : "rgb(var(--muted-foreground))"}
                opacity={row.triggered ? 0.92 : 0.5}
              />
              <text
                x={Math.min(648, left + barWidth + 6)}
                y={y + 14}
                className="num"
                style={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
              >
                +{row.points.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* total row */}
        <g>
          <text x="176" y={height - 12} textAnchor="end" style={{ fontSize: 11, fontWeight: 600, fill: "rgb(var(--foreground))" }}>
            published score
          </text>
          <rect x={x0} y={height - 23} width={width} height="16" rx="5" fill="rgb(var(--muted))" opacity="0.45" />
          <rect
            x={x0}
            y={height - 23}
            width={Math.max(3, at(Math.min(100, cumulative)) - x0)}
            height="16"
            rx="5"
            fill={RISK_COLORS[level]}
            opacity="0.9"
          />
          <text
            x={Math.min(648, at(Math.min(100, cumulative)) + 6)}
            y={height - 11}
            className="num"
            style={{ fontSize: 11.5, fontWeight: 600, fill: "rgb(var(--foreground))" }}
          >
            {Math.round(published)}
          </text>
        </g>

        {/* axis */}
        {[0, 30, SCORE_BANDS.alert, 90, 100].map((tick) => (
          <text
            key={tick}
            x={at(tick)}
            y={height - 1}
            textAnchor="middle"
            className="num"
            style={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
          >
            {tick}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peer placement — this payment against a reference distribution              */
/* -------------------------------------------------------------------------- */

/**
 * A histogram of peer scores with this payment marked. Where the marker sits
 * relative to the mass and the cutoff is the statistical context a reviewer
 * needs before deciding the score is unusual.
 */
export function ScorePlacement({
  score,
  peers,
  referenceLabel,
}: {
  score: number;
  peers: number[];
  referenceLabel: string;
}) {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    low: index * 10,
    count: 0,
  }));
  for (const peer of peers) {
    const bin = bins[Math.min(9, Math.floor(Math.max(0, Math.min(99.99, peer)) / 10))];
    if (bin) bin.count += 1;
  }
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  const level = scoreToLevel(score);

  const x0 = 26;
  const width = 606;
  const baseY = 96;
  const binW = width / bins.length;
  const markerX = x0 + (Math.min(100, Math.max(0, score)) / 100) * width;

  return (
    <div className="min-w-0">
      <svg viewBox="0 0 658 128" className="h-auto w-full" role="img"
        aria-label={`This payment scores ${Math.round(score)} against ${peers.length} ${referenceLabel} payments`}
      >
        <line x1={x0} y1={baseY} x2={x0 + width} y2={baseY} stroke="rgb(var(--border))" strokeWidth="1" />

        {bins.map((bin, index) => {
          const barH = (bin.count / max) * 58;
          const bx = x0 + index * binW + (binW - 30) / 2;
          const holdsMarker = score >= bin.low && score < bin.low + 10;
          return (
            <g key={bin.low}>
              <rect
                x={bx}
                y={baseY - barH}
                width="30"
                height={Math.max(bin.count > 0 ? 1.5 : 0, barH)}
                rx="3"
                fill={holdsMarker ? RISK_COLORS[level] : "rgb(var(--muted-foreground))"}
                opacity={holdsMarker ? 0.85 : 0.28}
              />
              <text
                x={bx + 15}
                y={baseY + 12}
                textAnchor="middle"
                className="num"
                style={{ fontSize: 8.5, fill: "rgb(var(--muted-foreground))" }}
              >
                {bin.count > 0 ? bin.count : ""}
              </text>
            </g>
          );
        })}

        {/* alert cutoff */}
        <line
          x1={x0 + (SCORE_BANDS.alert / 100) * width}
          y1="16"
          x2={x0 + (SCORE_BANDS.alert / 100) * width}
          y2={baseY}
          stroke="rgb(var(--risk-high))"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text
          x={x0 + (SCORE_BANDS.alert / 100) * width + 5}
          y="24"
          className="num"
          style={{ fontSize: 11.5, fill: "rgb(var(--risk-high))" }}
        >
          alert {SCORE_BANDS.alert}
        </text>

        {/* this payment */}
        <line x1={markerX} y1="26" x2={markerX} y2={baseY + 6} stroke={RISK_COLORS[level]} strokeWidth="2.5" />
        <circle cx={markerX} cy="26" r="4" fill={RISK_COLORS[level]} />
        <text
          x={Math.min(600, Math.max(78, markerX))}
          y="16"
          textAnchor="middle"
          className="num"
          style={{ fontSize: 11, fontWeight: 600, fill: RISK_COLORS[level] }}
        >
          this payment {Math.round(score)}
        </text>

        {/* axis */}
        {[0, SCORE_BANDS.alert, 100].map((tick) => (
          <text
            key={tick}
            x={x0 + (tick / 100) * width}
            y={baseY + 26}
            textAnchor="middle"
            className="num"
            style={{ fontSize: 11.5, fill: "rgb(var(--muted-foreground))" }}
          >
            {tick}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status split — settlement outcomes for the rows in view                     */
/* -------------------------------------------------------------------------- */

const STATUS_LABELS: Record<string, string> = {
  settled: "Settled",
  pending: "Pending",
  blocked: "Blocked",
  reversed: "Reversed",
};

export function StatusSplit({
  rows,
  className,
}: {
  rows: Array<{ status: string }>;
  className?: string;
}) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const entries = [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const total = rows.length;
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  if (entries.length === 0) {
    return <p className={cn("py-6 text-center text-[12px] text-muted-foreground", className)}>No rows in view.</p>;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Settlement status split">
        {entries.map((entry) => (
          <span
            key={entry.status}
            style={{
              width: `${(entry.count / Math.max(1, total)) * 100}%`,
              background: STATUS_COLORS[entry.status] ?? "rgb(var(--muted-foreground))",
            }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {entries.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: STATUS_COLORS[entry.status] ?? "rgb(var(--muted-foreground))" }}
              aria-hidden="true"
            />
            <span className="w-[76px] shrink-0 text-[12px] text-muted-foreground">
              {STATUS_LABELS[entry.status] ?? entry.status}
            </span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/70">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(entry.count / max) * 100}%`,
                  background: STATUS_COLORS[entry.status] ?? "rgb(var(--muted-foreground))",
                }}
              />
            </span>
            <span className="num w-10 shrink-0 text-right text-[12.5px] font-medium">{entry.count}</span>
            <span className="num w-12 shrink-0 text-right text-[11px] text-muted-foreground">
              {((entry.count / Math.max(1, total)) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Corridor ledger — concentration of the rows in view                         */
/* -------------------------------------------------------------------------- */

export function CorridorLedger({
  items,
  className,
}: {
  items: Array<{
    corridor: string;
    count: number;
    value: number;
    flagged: number;
    averageScore: number;
  }>;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  if (items.length === 0) {
    return <p className={cn("py-6 text-center text-[12px] text-muted-foreground", className)}>No corridors in view.</p>;
  }

  return (
    <ul className={cn("min-w-0 space-y-3", className)}>
      {items.map((item) => {
        const level = scoreToLevel(item.averageScore);
        return (
          <li key={item.corridor} className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <span className="num min-w-0 flex-1 truncate text-[12px] font-medium" title={item.corridor}>
                {item.corridor.replace("-", " → ")}
              </span>
              <span className="num shrink-0 text-[11px] text-muted-foreground">
                {item.count} · {item.flagged} flagged
              </span>
              <span className="num shrink-0 text-[12px] font-medium">${formatCompactNumber(item.value)}</span>
            </div>
            <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
              <span
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: RISK_COLORS[level] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
