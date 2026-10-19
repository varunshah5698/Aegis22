import "server-only";

import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import type { WorkspaceAnalytics } from "@/lib/data/analytics";
import { rangeOptions, type RangeKey } from "@/lib/data/common";

/**
 * Grounding layer between the database and the model.
 *
 * The model only ever sees the snapshot built here: exact figures from the
 * selected window, with the window and units stated. It is instructed to treat
 * anything outside the snapshot as unknown, which is what keeps answers
 * auditable instead of plausible-sounding.
 */

export interface EvidenceSnapshot {
  window: { range: RangeKey; label: string; days: number; from: string; to: string };
  units: { currency: string; note: string };
  totals: WorkspaceAnalytics["totals"];
  deltas: WorkspaceAnalytics["deltas"];
  previous: WorkspaceAnalytics["previous"];
  flow: Array<{ period: string; payments: number; valueUsd: number; flagged: number; avgScore: number }>;
  corridors: Array<{ corridor: string; payments: number; valueUsd: number; sharePercent: number; flagged: number; flaggedValueUsd: number; avgScore: number }>;
  scoreBands: Array<{ band: string; payments: number; sharePercent: number }>;
  signals: Array<{ signal: string; triggered: number; points: number }>;
  payers: Array<{ payer: string; payments: number; valueUsd: number; avgScore: number; flagged: number }>;
  currencies: Array<{ currency: string; payments: number; valueUsd: number }>;
  alerts: WorkspaceAnalytics["alerts"];
  cases: WorkspaceAnalytics["cases"];
  methodology: { modelVersion: string; alertCutoff: number };
  legend: Record<string, string>;
}

export function buildEvidence(analytics: WorkspaceAnalytics): EvidenceSnapshot {
  const label = rangeOptions.find((option) => option.value === analytics.range)?.label ?? analytics.range;
  const flow = analytics.series.slice(-14).map((point) => ({
    period: point.label,
    payments: point.count,
    valueUsd: point.value,
    flagged: point.flagged,
    avgScore: point.avgScore,
  }));

  return {
    window: {
      range: analytics.range,
      label,
      days: analytics.window.days,
      from: analytics.window.from.slice(0, 10),
      to: analytics.window.to.slice(0, 10),
    },
    units: {
      currency: "USD",
      note: "All values are USD base amounts converted at ingestion; nothing here is an FX market quote.",
    },
    totals: analytics.totals,
    deltas: analytics.deltas,
    previous: analytics.previous,
    flow,
    corridors: analytics.corridors.slice(0, 8).map((corridor) => ({
      corridor: corridor.corridor,
      payments: corridor.count,
      valueUsd: corridor.value,
      sharePercent: Math.round(corridor.share * 10) / 10,
      flagged: corridor.flagged,
      flaggedValueUsd: Math.round(corridor.flaggedValue),
      avgScore: corridor.avgScore,
    })),
    scoreBands: analytics.distribution
      .filter((bin) => bin.count > 0)
      .map((bin) => ({ band: `${bin.low}-${bin.high}`, payments: bin.count, sharePercent: Math.round(bin.share * 10) / 10 })),
    signals: analytics.signals.slice(0, 6).map((signal) => ({ signal: signal.label, triggered: signal.count, points: signal.points })),
    payers: analytics.peers.slice(0, 5).map((peer) => ({
      payer: peer.name,
      payments: peer.count,
      valueUsd: peer.value,
      avgScore: peer.avgScore,
      flagged: peer.flagged,
    })),
    currencies: analytics.currencies.slice(0, 6).map((currency) => ({
      currency: currency.currency,
      payments: currency.count,
      valueUsd: Math.round(currency.value),
    })),
    alerts: analytics.alerts,
    cases: analytics.cases,
    methodology: { modelVersion: MODEL_VERSION, alertCutoff: SCORE_BANDS.alert },
    legend: {
      window: "UTC calendar range the figures cover; 'days' is its length.",
      totals: "Payments scored in the window and their USD base value, flagged counts, score percentiles and detection latency.",
      flagged: "A count, not a value: payments scoring at or above the alert cutoff.",
      flaggedValueUsd: "USD base value of the flagged payments in that row.",
      flaggedShare: "Percentage of payments that were flagged.",
      deltas: "Percent change against the immediately preceding window of equal length; null means no basis for comparison.",
      previous: "Absolute totals for the preceding window.",
      flow: "Per-bucket payment counts, USD value, flagged counts and average score, oldest to newest.",
      corridors: "Top corridors by screened value. 'sharePercent' is the corridor's share of window value.",
      scoreBands: "Payments per 0-100 score band.",
      signals: "Model signals triggered on flagged payments: 'triggered' is how many flagged payments fired it, 'points' its total weight.",
      payers: "Largest payers by screened value with their average score and flagged count.",
      currencies: "Settlement currencies by count and USD base value.",
      alerts: "Alert rollup: totals, status and severity split, SLA pressure, unassigned count and median resolution hours.",
      cases: "Case rollup: open, in review, closed and opened in the window.",
    },
  };
}

export const SYSTEM_PROMPT = `You are the analyst inside Aegis, a cross-border payment monitoring workspace used by financial-crime teams.

Rules you must follow:
1. Use ONLY the EVIDENCE JSON supplied with the question. It is the single source of truth.
2. Never invent transactions, entities, corridors, rates, thresholds or figures. If the evidence does not contain something, say that it is not available in this window. The evidence carries a "legend" that defines each field — read it before claiming a field is missing, and remember that fields whose name starts with "flagged" are counts unless they say Value.
3. Distinguish clearly between (a) observations that are direct readings of the evidence, (b) interpretations or hypotheses, and (c) recommended next steps. Label them when it helps.
4. Never state or imply that a person or entity has committed a crime. Flagged activity is risk, not proof. Do not give legal or compliance determinations.
5. Quote exact figures with their units (USD base value, counts, scores out of 100) and name the window you are describing.
6. If the user asks something outside the evidence — market data, other organisations, tomorrow's activity — say what is missing and what would be needed.
7. Be concise and concrete. Prefer short paragraphs or tight bullets over long essays. Aim for under 200 words unless the question asks for depth.
8. When you refer to a corridor or payer, use the exact identifier from the evidence so the UI can link to it.
9. Speak in plain analyst language: say "flagged payments" or "average score", never raw evidence keys such as flaggedValueUsd or avgScore.

Answer as an analyst speaking to a colleague: direct, evidence-first, no filler.`;

export function buildUserPrompt(question: string, evidence: EvidenceSnapshot, page: string): string {
  return `PAGE CONTEXT: ${page}
QUESTION: ${question}

EVIDENCE:
${JSON.stringify(evidence)}`;
}
