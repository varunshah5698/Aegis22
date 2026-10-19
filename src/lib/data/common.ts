import { subDays } from "date-fns";

export type RangeKey = "24h" | "7d" | "30d" | "90d";

export const rangeOptions: Array<{ value: RangeKey; label: string; days: number; bucket: "hour" | "day" }> = [
  { value: "24h", label: "24 hours", days: 1, bucket: "hour" },
  { value: "7d", label: "7 days", days: 7, bucket: "day" },
  { value: "30d", label: "30 days", days: 30, bucket: "day" },
  { value: "90d", label: "90 days", days: 90, bucket: "day" },
];

export function parseRange(value: string | undefined, fallback: RangeKey = "7d"): RangeKey {
  return rangeOptions.some((option) => option.value === value) ? (value as RangeKey) : fallback;
}

export function rangeWindow(range: RangeKey, now = new Date()): { from: Date; to: Date; days: number } {
  const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[1]!;
  return { from: subDays(now, option.days), to: now, days: option.days };
}

export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function pageBounds(page: number, pageSize = 25): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function formatBucketLabel(date: Date, bucket: "hour" | "day"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(bucket === "hour" ? { hour: "2-digit", hour12: false } : {}),
  }).format(date);
}

/** Buckets a list of timestamps into a dense series so charts never show gaps. */
export function bucketSeries<T>(
  rows: T[],
  getDate: (row: T) => Date,
  from: Date,
  to: Date,
  bucket: "hour" | "day",
  aggregate: (items: T[]) => { count: number; value: number } = (items) => ({ count: items.length, value: 0 }),
) {
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  const start = new Date(from);
  if (bucket === "day") start.setUTCHours(0, 0, 0, 0);
  else start.setUTCMinutes(0, 0, 0);

  const map = new Map<number, T[]>();
  for (const row of rows) {
    const time = getDate(row).getTime();
    if (time < start.getTime() || time > to.getTime()) continue;
    const key = Math.floor((time - start.getTime()) / stepMs) * stepMs + start.getTime();
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const points: Array<{ at: string; label: string; count: number; value: number }> = [];
  for (let time = start.getTime(); time <= to.getTime(); time += stepMs) {
    const items = map.get(time) ?? [];
    const totals = aggregate(items);
    points.push({
      at: new Date(time).toISOString(),
      label: formatBucketLabel(new Date(time), bucket),
      count: totals.count,
      value: totals.value,
    });
  }
  return points;
}
