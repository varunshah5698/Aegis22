import type { AccountContext, AccountHistoryItem, RiskTransaction } from "@/lib/risk/types";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function hoursBetween(a: string | Date, b: string | Date): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / HOUR_MS;
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY_MS;
}

export function accountAgeDays(account: AccountContext | undefined, at: string): number {
  if (!account) return 0;
  return Math.max(0, daysBetween(account.openedAt, at));
}

export function historyWithin(
  account: AccountContext | undefined,
  at: string,
  hours: number,
  direction?: "in" | "out",
): AccountHistoryItem[] {
  if (!account) return [];
  const end = new Date(at).getTime();
  const start = end - hours * HOUR_MS;
  return account.history.filter((item) => {
    const time = new Date(item.createdAt).getTime();
    return time <= end && time >= start && (direction ? item.direction === direction : true);
  });
}

export function sumAmount(items: AccountHistoryItem[]): number {
  return items.reduce((total, item) => total + item.amountBase, 0);
}

export function accountFor(
  accounts: Record<string, AccountContext>,
  id: string,
): AccountContext | undefined {
  return accounts[id];
}

export function relatedIds(
  relatedAccounts: Record<string, string[]>,
  accountId: string,
): string[] {
  const direct = relatedAccounts[accountId] ?? [];
  return Array.from(new Set([accountId, ...direct]));
}

export function corridorOf(transaction: Pick<RiskTransaction, "senderCountry" | "receiverCountry">) {
  return `${transaction.senderCountry}-${transaction.receiverCountry}`;
}

/** Daily value series for the trailing baseline window, in base currency. */
export function dailyValues(account: AccountContext, at: string, days: number): number[] {
  const end = new Date(at).getTime();
  const start = end - days * DAY_MS;
  const buckets = new Map<number, number>();
  for (const item of account.history) {
    if (item.direction !== "out") continue;
    const time = new Date(item.createdAt).getTime();
    if (time < start || time > end) continue;
    const day = Math.floor((time - start) / DAY_MS);
    buckets.set(day, (buckets.get(day) ?? 0) + item.amountBase);
  }
  return Array.from({ length: days }, (_, index) => buckets.get(index) ?? 0);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((total, value) => total + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
