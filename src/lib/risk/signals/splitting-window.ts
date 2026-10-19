import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { relatedIds, round, sumAmount } from "@/lib/risk/context";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function splittingWindowSignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const at = new Date(transaction.createdAt).getTime();
  const start = at - config.splittingWindowHours * 3_600_000;
  const threshold = config.reportingThresholdUsd;
  const subThreshold = threshold * config.splittingSubThresholdRatio;
  const accountIds = relatedIds(context.relatedAccounts, transaction.senderAccountId);

  const items = accountIds.flatMap((accountId) => {
    const account = context.accounts[accountId];
    const relevant = (account?.history ?? []).filter((item) => {
      if (item.direction !== "out") return false;
      if (item.externalId && item.externalId === transaction.externalId) return false;
      const time = new Date(item.createdAt).getTime();
      return time >= start && time <= at;
    });
    return relevant.map((item) => ({ ...item, accountId }));
  });

  const eligible = items.filter((item) => item.amountBase < subThreshold);
  const includesCurrent =
    transaction.amountBase < subThreshold &&
    !eligible.some((item) => item.externalId === transaction.externalId);

  const candidates = includesCurrent
    ? [
        ...eligible,
        {
          accountId: transaction.senderAccountId,
          amountBase: transaction.amountBase,
          counterpartyId: transaction.receiverAccountId,
          corridor: `${transaction.senderCountry}-${transaction.receiverCountry}`,
          createdAt: transaction.createdAt,
          direction: "out" as const,
          externalId: transaction.externalId,
        },
      ]
    : eligible;

  const distinctAccounts = new Set(candidates.map((item) => item.accountId));
  const total = sumAmount(candidates);
  const withinWindowHours = config.splittingWindowHours;

  const qualifies =
    candidates.length >= config.splittingMinTransactions &&
    distinctAccounts.size >= config.splittingMinRelatedAccounts + 1 &&
    total > threshold;

  let raw = 0;
  if (qualifies) {
    const excess = Math.min(1, (total / threshold - 1) * 0.5);
    const volume = Math.min(1, candidates.length / 12);
    raw = Math.min(1, 0.65 + excess + volume * 0.15);
  }

  const facts = {
    transaction_count: candidates.length,
    related_accounts: distinctAccounts.size,
    total_base: round(total),
    threshold,
    window_hours: withinWindowHours,
  };

  const narrative = qualifies
    ? `${candidates.length} transactions from ${distinctAccounts.size} related accounts totaling USD ${usd.format(total)} fell within ${withinWindowHours} hours, each below the USD ${usd.format(threshold)} threshold.`
    : `No sub-threshold cluster from related accounts crossed the reporting threshold inside the ${withinWindowHours}-hour window.`;

  return { id: "splitting_window", raw, narrative, facts };
}
