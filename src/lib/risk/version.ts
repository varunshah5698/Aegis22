import { MODEL_VERSION } from "@/config/risk";

export const MODEL_VERSION_VALUE = MODEL_VERSION;
export const MODEL_NAMES = {
  rule_based: "Rule-based ensemble",
  weighted_ensemble: "Weighted ensemble (rules + logistic)",
} as const;
