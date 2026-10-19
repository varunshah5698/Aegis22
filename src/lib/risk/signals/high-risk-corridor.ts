import { corridorTier, COUNTRY_TIER_LABEL, corridorRiskValue } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { round } from "@/lib/risk/context";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

export function highRiskCorridorSignal(
  transaction: RiskTransaction,
  _context: ScoringContext,
  _config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const tier = corridorTier(transaction.senderCountry, transaction.receiverCountry);
  const raw = corridorRiskValue(transaction.senderCountry, transaction.receiverCountry);
  const facts = {
    corridor: `${transaction.senderCountry}-${transaction.receiverCountry}`,
    tier,
    risk_value: round(raw, 2),
  };

  const narrative =
    tier === "standard"
      ? `The ${transaction.senderCountry}–${transaction.receiverCountry} corridor is not on the high-risk list.`
      : `The ${transaction.senderCountry}–${transaction.receiverCountry} corridor is in the ${COUNTRY_TIER_LABEL[tier].toLowerCase()} jurisdiction tier.`;

  return { id: "high_risk_corridor", raw, narrative, facts };
}
