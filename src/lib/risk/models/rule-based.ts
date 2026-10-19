import { MODEL_VERSION } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { scoreWithSignals } from "@/lib/risk/engine";
import type { RiskTransaction, ScoreResult, Scorer, ScoringContext } from "@/lib/risk/types";

export class RuleBasedScorer implements Scorer {
  readonly id = "rule_based";
  readonly version: string;

  constructor(private readonly config: RiskConfig = defaultRiskConfig) {
    this.version = config.modelVersion || MODEL_VERSION;
  }

  score(transaction: RiskTransaction, context: ScoringContext): ScoreResult {
    const result = scoreWithSignals(transaction, context, this.config);
    return { ...result, model: this.id, modelVersion: this.version };
  }
}
