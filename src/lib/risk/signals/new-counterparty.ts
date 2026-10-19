import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { accountAgeDays } from "@/lib/risk/context";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

export function newCounterpartySignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  _config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const sender = context.accounts[transaction.senderAccountId];
  const at = new Date(transaction.createdAt).getTime();
  const lookback = 180 * 86_400_000;

  const seen = (sender?.history ?? []).some((item) => {
    if (item.direction !== "out" || item.counterpartyId !== transaction.receiverAccountId) return false;
    if (item.externalId && item.externalId === transaction.externalId) return false;
    return new Date(item.createdAt).getTime() >= at - lookback && new Date(item.createdAt).getTime() <= at;
  });

  const age = accountAgeDays(sender, transaction.createdAt);
  let raw = seen ? 0 : 1;
  if (!seen && age < 14) raw = 1;
  else if (!seen && age < 30) raw = 0.85;
  else if (!seen) raw = 0.75;

  const facts = {
    receiver_id: transaction.receiverAccountId,
    previous_transfers: seen ? 1 : 0,
    account_age_days: Math.round(age),
  };

  const narrative = seen
    ? `The receiver has appeared in this account's transfer history within the last 180 days.`
    : `The receiver ${transaction.receiverName || transaction.receiverAccountId} is new for this sender in the last 180 days.`;

  return { id: "new_counterparty", raw, narrative, facts };
}
