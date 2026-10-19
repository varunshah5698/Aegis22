import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import {
  dailyValues,
  mean,
  round,
  stdDev,
  sumAmount,
} from "@/lib/risk/context";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

const BASE_WINDOW_HOURS = 24;
const MIN_BASELINE = 5;

export function velocitySignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const account = context.accounts[transaction.senderAccountId];
  const at = new Date(transaction.createdAt).getTime();
  const since = at - BASE_WINDOW_HOURS * 3_600_000;

  const recent = (account?.history ?? []).filter((item) => {
    if (item.direction !== "out") return false;
    const time = new Date(item.createdAt).getTime();
    if (item.externalId && item.externalId === transaction.externalId) return false;
    return time >= since && time <= at;
  });

  const recentCount = recent.length + 1;
  const recentValue = sumAmount(recent) + transaction.amountBase;

  const baselineTransactions = (account?.history ?? []).filter(
    (item) => item.direction === "out" && !(item.externalId && item.externalId === transaction.externalId),
  ).length;

  const daily = dailyValues(
    account ?? {
      id: "",
      entityId: "",
      entityName: "",
      entityKind: "individual",
      country: "",
      currency: "",
      openedAt: transaction.createdAt,
      pepFlag: false,
      nomineeEntityCount: 0,
      history: [],
    },
    transaction.createdAt,
    90,
  );
  const avgDailyValue = mean(daily);
  const sdDailyValue = stdDev(daily);

  const facts = {
    recent_count_24h: recentCount,
    recent_value_24h: round(recentValue),
    baseline_daily_value: round(avgDailyValue),
    baseline_transactions_90d: baselineTransactions,
  };

  if (baselineTransactions < MIN_BASELINE) {
    const raw = recentCount >= 4 ? 0.5 : 0;
    return {
      id: "velocity",
      raw,
      narrative:
        raw > 0
          ? `${recentCount} transfers left this account in 24 hours, but the account has only ${baselineTransactions} prior transfers to establish a baseline.`
          : `Activity is within a normal range for this account.`,
      facts,
    };
  }

  const zValue = (recentValue - avgDailyValue) / Math.max(sdDailyValue, avgDailyValue * 0.5, 1);
  const avgDailyCount = Math.max(baselineTransactions / 90, 0.1);
  const zCount = (recentCount - avgDailyCount) / Math.max(Math.sqrt(avgDailyCount + 1), 0.5);
  const z = Math.max(zValue, zCount);
  // A handful of tiny payments is not a velocity event even if the count is high.
  const material = recentValue >= avgDailyValue * 0.5;
  const raw = material ? Math.max(0, Math.min(1, z / config.velocityZScoreCap)) : 0;

  const narrative =
    raw >= 0.5
      ? `${recentCount} transfers worth USD ${round(recentValue).toLocaleString("en-US")} left this account in the last 24 hours, ${round(z, 1)} standard deviations above its 90-day baseline.`
      : `Outbound value over 24 hours is consistent with this account's 90-day baseline.`;

  return { id: "velocity", raw, narrative, facts };
}
