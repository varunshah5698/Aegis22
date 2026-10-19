"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";

import { RISK_COLORS, SCORE_BANDS, SIGNAL_WEIGHTS, scoreToLevel } from "@/config/risk";
import { Button } from "@/components/ui/button";
import type { TransactionDetail } from "@/lib/data/transactions";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

type Factor = TransactionDetail["riskFactors"][number];

const ALERT_CUTOFF = SCORE_BANDS.alert;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

/** Arc dial. The tick at the alert cutoff is what turns a score into a decision. */
export function ScoreDial({ score, size = 148 }: { score: number; size?: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const level = scoreToLevel(score);
  const color = RISK_COLORS[level];
  const offset = circumference * (1 - clamp(score) / 100);
  const cutoffX = Number((60 + radius * Math.cos(((ALERT_CUTOFF / 100) * 2 * Math.PI))).toFixed(2));
  const cutoffY = Number((60 + radius * Math.sin(((ALERT_CUTOFF / 100) * 2 * Math.PI))).toFixed(2));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`Score ${Math.round(score)} out of 100, ${level}`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgb(var(--muted))" strokeWidth="7" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
        <circle
          cx={cutoffX}
          cy={cutoffY}
          r="2.6"
          fill="rgb(var(--foreground))"
          opacity="0.55"
        />
        <g transform={`rotate(90 60 60)`}>
          <text x="60" y="58" textAnchor="middle" className="num" style={{ fontSize: 26, fill: "rgb(var(--foreground))" }}>
            {Math.round(score)}
          </text>
          <text x="60" y="74" textAnchor="middle" style={{ fontSize: 8, letterSpacing: 1.6, fill: "rgb(var(--muted-foreground))" }}>
            OF 100
          </text>
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-1">
        <span className="text-[10px] capitalize" style={{ color }}>
          {level}
        </span>
      </div>
    </div>
  );
}

/**
 * Contribution simulator.
 *
 * It re-runs the published scoring formula over the signal contributions this
 * payment was actually scored with — same weights, same normalisation. Moving a
 * lever answers "how much of this decision rests on this signal", not "what
 * would the model say about a different payment". Stated on the panel so nobody
 * mistakes it for a re-score.
 */
export function ScoreSimulator({ factors, published }: { factors: Factor[]; published: number }) {
  const baseline = React.useMemo(
    () => Object.fromEntries(factors.map((factor) => [factor.id, { on: true, strength: 1 }])) as Record<
      string,
      { on: boolean; strength: number }
    >,
    [factors],
  );
  const [state, setState] = React.useState(baseline);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setState(baseline);
    setTouched(false);
  }, [baseline]);

  // The published points were normalised against the model's full weight, not
  // just the signals that fired here, so the simulator has to use the same
  // denominator or every scenario would read higher than the real score.
  const totalWeight = React.useMemo(
    () => Object.values(SIGNAL_WEIGHTS).reduce((sum, weight) => sum + weight, 0) || 1,
    [],
  );

  const simulated = React.useMemo(() => {
    const points = factors.reduce((sum, factor) => {
      const config = state[factor.id] ?? { on: true, strength: 1 };
      if (!config.on) return sum;
      const raw = Math.max(0, Math.min(1, factor.raw * config.strength));
      return sum + (raw * (factor.weight || 0) * 100) / totalWeight;
    }, 0);
    return clamp(Math.round(points));
  }, [factors, state, totalWeight]);

  const delta = simulated - Math.round(published);
  const crossing = Math.round(published) < ALERT_CUTOFF && simulated >= ALERT_CUTOFF;
  const level = scoreToLevel(simulated);
  const maxPoints = Math.max(1, ...factors.map((factor) => factor.points));

  if (factors.length === 0) {
    return (
      <p className="px-5 py-6 text-[12px] text-muted-foreground">
        This payment has no scored signal contributions, so there is nothing to simulate.
      </p>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <p className="num text-[30px] font-medium leading-9 tracking-[-0.04em]" style={{ color: RISK_COLORS[level] }}>
            {simulated}
          </p>
          <div className="pb-1">
            <p className="text-[11px] text-muted-foreground">
              simulated · published <span className="num">{Math.round(published)}</span>
            </p>
            <p className={cn("num text-[11px]", delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-risk-high" : "text-risk-low")}>
              {delta === 0 ? "unchanged" : `${delta > 0 ? "+" : ""}${delta} points`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {crossing ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-risk-high/35 bg-risk-high/10 px-2 py-1 text-[10.5px] text-risk-high">
              <TriangleAlert className="size-3" aria-hidden="true" /> crosses the alert cutoff
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => {
              setState(baseline);
              setTouched(false);
            }}
            disabled={!touched}
          >
            <RotateCcw className="size-3" aria-hidden="true" /> Reset
          </Button>
        </div>
      </div>

      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${simulated}%`, background: RISK_COLORS[level] }}
        />
        <span
          className="absolute inset-y-0 w-px bg-foreground/50"
          style={{ left: `${ALERT_CUTOFF}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span className="num">alert at {ALERT_CUTOFF}</span>
        <span>100</span>
      </p>

      <ul className="mt-4 space-y-2.5">
        {factors.map((factor) => {
          const config = state[factor.id] ?? { on: true, strength: 1 };
          return (
            <li key={factor.id} className={cn("rounded-[10px] border border-border/70 px-3 py-2.5", !config.on && "opacity-55")}>
              <div className="flex items-start gap-2.5">
                <input
                  id={`sim-${factor.id}`}
                  type="checkbox"
                  checked={config.on}
                  onChange={(event) => {
                    setState((current) => ({
                      ...current,
                      [factor.id]: { on: event.target.checked, strength: (current[factor.id] ?? config).strength },
                    }));
                    setTouched(true);
                  }}
                  className="mt-0.5 size-3.5 shrink-0 accent-[rgb(var(--foreground))]"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`sim-${factor.id}`} className="block text-[11.5px] font-medium leading-4">
                    {factor.label}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (factor.points / maxPoints) * 100 * config.strength)}%`,
                          background: factor.triggered ? RISK_COLORS.high : "rgb(var(--foreground) / 0.35)",
                        }}
                      />
                    </div>
                    <span className="num w-12 shrink-0 text-right text-[10.5px] text-muted-foreground">
                      {(factor.points * config.strength).toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-6">
                <span className="text-[10px] text-muted-foreground">strength</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.strength}
                  aria-label={`${factor.label} strength`}
                  onChange={(event) => {
                    const strength = Number(event.target.value);
                    setState((current) => ({
                      ...current,
                      [factor.id]: { on: (current[factor.id] ?? config).on, strength },
                    }));
                    setTouched(true);
                  }}
                  className="h-1 flex-1 cursor-pointer accent-[rgb(var(--accent))]"
                />
                <span className="num w-9 text-right text-[10px] text-muted-foreground">
                  {Math.round(config.strength * 100)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-border/70 bg-muted/30 px-3 py-2.5 text-[10.5px] leading-4 text-muted-foreground">
        <SlidersHorizontal className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          Recomputes the published score from this payment&apos;s own signal weights and strengths. It is a sensitivity
          view, not a fresh score: changing the levers does not re-read history, counterparties or the network.
        </span>
      </div>
    </div>
  );
}

/** Where the amount sits against the reporting threshold and the peer median. */
export function AmountLadder({
  amountBase,
  peerMedian,
  peerMax,
}: {
  amountBase: number;
  peerMedian: number | null;
  peerMax: number;
}) {
  const ceiling = Math.max(amountBase, peerMax, 10_000 * 2) * 1.05;
  const marker = (value: number) => `${Math.min(100, (value / ceiling) * 100)}%`;

  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-risk-low/60 to-risk-medium/70"
          style={{ width: marker(amountBase) }}
        />
        <span
          className="absolute inset-y-0 w-px bg-foreground/60"
          style={{ left: marker(10_000) }}
          aria-hidden="true"
        />
        {peerMedian ? (
          <span
            className="absolute -top-1 size-1.5 -translate-x-1/2 rounded-full border border-background bg-foreground"
            style={{ left: marker(peerMedian) }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
        <span>
          this payment <span className="num text-foreground">{formatCurrency(amountBase, "USD", { maximumFractionDigits: 0 })}</span>
        </span>
        <span className="num">threshold $10,000</span>
        <span className="num">
          peer median {peerMedian ? formatCompactNumber(peerMedian) : "—"}
        </span>
      </div>
    </div>
  );
}
