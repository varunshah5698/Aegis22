import { scoreToLevel, SIGNAL_LABELS } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { buildExplanation } from "@/lib/risk/explain";
import type {
  RiskTransaction,
  ScoreResult,
  ScoringContext,
  SignalContribution,
  SignalFunction,
} from "@/lib/risk/types";
import { amountThresholdSignal } from "@/lib/risk/signals/amount-threshold";
import { circularPathSignal } from "@/lib/risk/signals/circular-path";
import { currencyMismatchSignal } from "@/lib/risk/signals/currency-mismatch";
import { firstTimeCorridorSignal } from "@/lib/risk/signals/first-time-corridor";
import { highRiskCorridorSignal } from "@/lib/risk/signals/high-risk-corridor";
import { newCounterpartySignal } from "@/lib/risk/signals/new-counterparty";
import { pepExposureSignal } from "@/lib/risk/signals/pep-exposure";
import { shellIntermediarySignal } from "@/lib/risk/signals/shell-intermediary";
import { splittingWindowSignal } from "@/lib/risk/signals/splitting-window";
import { velocitySignal } from "@/lib/risk/signals/velocity";

export const signals: SignalFunction[] = [
  amountThresholdSignal,
  velocitySignal,
  highRiskCorridorSignal,
  newCounterpartySignal,
  splittingWindowSignal,
  circularPathSignal,
  shellIntermediarySignal,
  firstTimeCorridorSignal,
  currencyMismatchSignal,
  pepExposureSignal,
];

export function scoreWithSignals(
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
  signalSet: SignalFunction[] = signals,
): ScoreResult {
  const totalWeight = Object.values(config.weights).reduce((total, weight) => total + weight, 0);

  const contributions: SignalContribution[] = signalSet.map((signal) => {
    const result = signal(transaction, context, config);
    const weight = config.weights[result.id] ?? 0;
    const raw = Math.max(0, Math.min(1, result.raw));
    return {
      id: result.id,
      label: SIGNAL_LABELS[result.id],
      raw,
      weight,
      points: totalWeight > 0 ? (raw * weight * 100) / totalWeight : 0,
      triggered: raw >= 0.5,
      narrative: result.narrative,
      facts: result.facts,
    };
  });

  const rawScore = contributions.reduce((total, item) => total + item.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const level = scoreToLevel(score);
  const explanation = buildExplanation(contributions, score, level);

  return {
    score,
    level,
    contributions: contributions.sort((a, b) => b.points - a.points),
    explanation,
    modelVersion: config.modelVersion,
    model: "rule_based",
  };
}
