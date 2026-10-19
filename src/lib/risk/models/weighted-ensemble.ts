import { ENSEMBLE, scoreToLevel } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { buildExplanation } from "@/lib/risk/explain";
import { scoreWithSignals } from "@/lib/risk/engine";
import type { RiskTransaction, ScoreResult, Scorer, ScoringContext } from "@/lib/risk/types";

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/**
 * Blends the auditable rule score with a logistic probability whose coefficients
 * live in config/risk.ts. Contributions are scaled to the blended score so the
 * UI can still show a breakdown that sums to the headline number.
 */
export class WeightedEnsembleScorer implements Scorer {
  readonly id = "weighted_ensemble";
  readonly version: string;

  constructor(private readonly config: RiskConfig = defaultRiskConfig) {
    this.version = config.modelVersion || "v1";
  }

  score(transaction: RiskTransaction, context: ScoringContext): ScoreResult {
    const ruleResult = scoreWithSignals(transaction, context, this.config);

    const linear = ruleResult.contributions.reduce<number>(
      (total, contribution) =>
        total + (ENSEMBLE.coefficients[contribution.id] ?? 0) * contribution.raw,
      ENSEMBLE.intercept,
    );
    const probability = sigmoid(linear) * 100;
    const blended = Math.max(
      0,
      Math.min(100, Math.round(ruleResult.score * ENSEMBLE.ruleWeight + probability * ENSEMBLE.modelWeight)),
    );
    const level = scoreToLevel(blended);

    const scale = ruleResult.score > 0 ? blended / ruleResult.score : 0;
    const contributions = ruleResult.contributions.map((item) => ({
      ...item,
      points: Math.round(item.points * scale * 10) / 10,
    }));

    return {
      score: blended,
      level,
      contributions,
      explanation: buildExplanation(contributions, blended, level),
      model: this.id,
      modelVersion: this.version,
    };
  }
}
