import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";
import { round } from "@/lib/risk/context";

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function amountThresholdSignal(
  transaction: RiskTransaction,
  _context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const threshold = config.reportingThresholdUsd;
  const ratio = transaction.amountBase / threshold;

  let raw = 0;
  if (ratio >= 0.5 && ratio < 0.9) raw = ((ratio - 0.5) / 0.4) * 0.35;
  else if (ratio >= 0.9 && ratio <= 1.1) raw = 1;
  else if (ratio > 1.1 && ratio <= 3) raw = 0.55;
  else if (ratio > 3) raw = 0.7;

  const facts = {
    amount_base: round(transaction.amountBase),
    threshold,
    ratio: round(ratio, 3),
  };

  let narrative: string;
  if (ratio >= 0.9 && ratio <= 1.1) {
    narrative = `The transfer of USD ${usd.format(transaction.amountBase)} sits within 10% of the USD ${usd.format(threshold)} reporting threshold.`;
  } else if (ratio >= 0.5 && ratio < 0.9) {
    narrative = `The transfer of USD ${usd.format(transaction.amountBase)} is approaching the USD ${usd.format(threshold)} reporting threshold.`;
  } else if (ratio > 3) {
    narrative = `The transfer of USD ${usd.format(transaction.amountBase)} is ${round(ratio, 1)}× the USD ${usd.format(threshold)} reporting threshold.`;
  } else if (ratio > 1.1) {
    narrative = `The transfer of USD ${usd.format(transaction.amountBase)} exceeds the USD ${usd.format(threshold)} reporting threshold by ${round((ratio - 1) * 100, 0)}%.`;
  } else {
    narrative = `The transfer is below the reporting threshold and is not unusual on size alone.`;
  }

  return { id: "amount_threshold", raw, narrative, facts };
}
