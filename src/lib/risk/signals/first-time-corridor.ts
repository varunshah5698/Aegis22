import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

export function firstTimeCorridorSignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  _config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const sender = context.accounts[transaction.senderAccountId];
  const corridor = `${transaction.senderCountry}-${transaction.receiverCountry}`;
  const at = new Date(transaction.createdAt).getTime();

  const prior = (sender?.history ?? []).filter((item) => {
    if (item.direction !== "out") return false;
    if (item.externalId && item.externalId === transaction.externalId) return false;
    if (item.corridor !== corridor) return false;
    return new Date(item.createdAt).getTime() <= at;
  });

  const raw = prior.length > 0 ? 0 : (sender?.history.length ?? 0) > 0 ? 0.85 : 1;

  return {
    id: "first_time_corridor",
    raw,
    narrative:
      prior.length > 0
        ? `The account has used the ${corridor} corridor ${prior.length} times before.`
        : `This is the first ${corridor} transfer for an account that otherwise has transfer history.`,
    facts: {
      corridor,
      prior_transfers: prior.length,
    },
  };
}
