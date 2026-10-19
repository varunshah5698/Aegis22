import {
  CIRCULAR_FLOW,
  MODEL_VERSION,
  REPORTING_THRESHOLD_USD,
  SCORE_BANDS,
  SHELL_INTERMEDIARY,
  SIGNAL_WEIGHTS,
  SPLITTING,
  VELOCITY,
} from "@/config/risk";

export interface RiskConfig {
  reportingThresholdUsd: number;
  splittingWindowHours: number;
  splittingMinTransactions: number;
  splittingSubThresholdRatio: number;
  splittingMinRelatedAccounts: number;
  circularWindowHours: number;
  circularMaxEdges: number;
  circularMinRetainedRatio: number;
  velocityZScoreCap: number;
  velocityMinBaselineTransactions: number;
  shellMaxAgeDays: number;
  shellPassThroughRatio: number;
  shellNomineeCount: number;
  weights: typeof SIGNAL_WEIGHTS;
  bands: typeof SCORE_BANDS;
  modelVersion: string;
}

export const defaultRiskConfig: RiskConfig = {
  reportingThresholdUsd: REPORTING_THRESHOLD_USD,
  splittingWindowHours: SPLITTING.windowHours,
  splittingMinTransactions: SPLITTING.minimumTransactions,
  splittingSubThresholdRatio: SPLITTING.subThresholdRatio,
  splittingMinRelatedAccounts: SPLITTING.minimumRelatedAccounts,
  circularWindowHours: CIRCULAR_FLOW.windowHours,
  circularMaxEdges: CIRCULAR_FLOW.maxHops,
  circularMinRetainedRatio: CIRCULAR_FLOW.minimumRetainedRatio,
  velocityZScoreCap: VELOCITY.zScoreCap,
  velocityMinBaselineTransactions: VELOCITY.minimumBaselineTransactions,
  shellMaxAgeDays: SHELL_INTERMEDIARY.maxAgeDays,
  shellPassThroughRatio: SHELL_INTERMEDIARY.passThroughRatio,
  shellNomineeCount: SHELL_INTERMEDIARY.nomineeSharedEntityCount,
  weights: SIGNAL_WEIGHTS,
  bands: SCORE_BANDS,
  modelVersion: MODEL_VERSION,
};
