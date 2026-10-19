import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

export function formatDateTime(value: string | Date, timeZone = "UTC"): string {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function formatDate(value: string | Date, timeZone = "UTC"): string {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatShortDate(value: string | Date, timeZone = "UTC"): string {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTime(value: string | Date, timeZone = "UTC"): string {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function relativeTime(value: string | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isoDateOnly(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export function formatMonthDay(value: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, month: "short", day: "numeric" }).format(value);
}
