import { accountAgeDays, relatedIds, sumAmount } from "@/lib/risk/context";
import type {
  RiskTransaction,
  ScoringContext,
} from "@/lib/risk/types";
import type { RuleCondition, RuleDefinition, RuleGroup } from "@/lib/schemas/rule";

export interface RuleEvaluation {
  matched: boolean;
  matchedConditions: RuleCondition[];
}

function toNumber(value: RuleCondition["value"]): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function evaluateCondition(
  condition: RuleCondition,
  transaction: RiskTransaction,
  context: ScoringContext,
): boolean {
  const { field, operator } = condition;

  const account = context.accounts[transaction.senderAccountId];
  const at = transaction.createdAt;
  const velocityValue = sumAmount(
    (account?.history ?? []).filter((item) => {
      if (item.direction !== "out") return false;
      const time = new Date(item.createdAt).getTime();
      const end = new Date(at).getTime();
      return time <= end && time >= end - 24 * 3_600_000;
    }),
  );

  const timeWindow = (() => {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) return 0;
    const hours = Number(condition.value[0]);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    const end = new Date(at).getTime();
    const start = end - hours * 3_600_000;
    return sumAmount(
      relatedIds(context.relatedAccounts, transaction.senderAccountId).flatMap((accountId) =>
        (context.accounts[accountId]?.history ?? []).filter((item) => {
          if (item.direction !== "out") return false;
          const time = new Date(item.createdAt).getTime();
          return time >= start && time <= end;
        }),
      ),
    );
  })();

  switch (field) {
    case "amount":
      return compare(transaction.amount, operator, condition.value);
    case "amount_base":
      return compare(transaction.amountBase, operator, condition.value);
    case "velocity_24h":
      return compare(velocityValue, operator, condition.value);
    case "account_age_days":
      return compare(accountAgeDays(account, at), operator, condition.value);
    case "time_window_sum": {
      if (operator !== "within_last_hours") return false;
      const threshold = toNumber(Array.isArray(condition.value) ? (condition.value[1] ?? 0) : 0) ?? 0;
      return timeWindow >= threshold;
    }
    case "new_counterparty": {
      const seen = (account?.history ?? []).some(
        (item) =>
          item.direction === "out" &&
          item.counterpartyId === transaction.receiverAccountId &&
          new Date(item.createdAt).getTime() <= new Date(at).getTime(),
      );
      const isNew = !seen;
      const expected = condition.value === true || condition.value === "true";
      return operator === "equals" ? isNew === expected : isNew !== expected;
    }
    case "corridor":
      return compareText(`${transaction.senderCountry}-${transaction.receiverCountry}`, operator, condition.value);
    case "sender_country":
      return compareText(transaction.senderCountry, operator, condition.value);
    case "receiver_country":
      return compareText(transaction.receiverCountry, operator, condition.value);
    case "channel":
      return compareText(transaction.channel, operator, condition.value);
    default:
      return false;
  }
}

function compare(
  actual: number,
  operator: RuleCondition["operator"],
  value: RuleCondition["value"],
): boolean {
  const numeric = toNumber(value);
  switch (operator) {
    case "greater_than":
      return numeric !== null && actual > numeric;
    case "greater_or_equal":
      return numeric !== null && actual >= numeric;
    case "less_than":
      return numeric !== null && actual < numeric;
    case "less_or_equal":
      return numeric !== null && actual <= numeric;
    case "equals":
      return numeric !== null && actual === numeric;
    case "between": {
      if (!Array.isArray(value) || value.length !== 2) return false;
      const [min, max] = value as [unknown, unknown];
      return actual >= Number(min) && actual <= Number(max);
    }
    default:
      return false;
  }
}

function compareText(
  actual: string,
  operator: RuleCondition["operator"],
  value: RuleCondition["value"],
): boolean {
  if (operator === "in") {
    const list = Array.isArray(value) ? value.map((item) => String(item).toUpperCase()) : [];
    return list.includes(actual.toUpperCase());
  }
  if (operator === "not_equals") return actual.toUpperCase() !== String(value).toUpperCase();
  return actual.toUpperCase() === String(value).toUpperCase();
}

function evaluateGroup(
  group: RuleGroup,
  transaction: RiskTransaction,
  context: ScoringContext,
  matched: RuleCondition[],
): boolean {
  const results = group.children.map((child) => {
    if (child.kind === "group") {
      return evaluateGroup(child, transaction, context, matched);
    }
    const isMatch = evaluateCondition(child, transaction, context);
    if (isMatch) matched.push(child);
    return isMatch;
  });

  return group.logic === "and" ? results.every(Boolean) : results.some(Boolean);
}

export function evaluateRule(
  definition: RuleDefinition,
  transaction: RiskTransaction,
  context: ScoringContext,
): RuleEvaluation {
  const matchedConditions: RuleCondition[] = [];
  const matched = evaluateGroup(definition.root, transaction, context, matchedConditions);
  return { matched, matchedConditions };
}
