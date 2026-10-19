import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function formatCurrency(
  amount: number | string,
  currency: string,
  options: { compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.maximumFractionDigits ?? (options.compact ? 1 : 2),
  }).format(value);
}

/**
 * Payment amounts always carry an explicit ISO code so ¥, CN¥ and SGD sibling
 * formats can never be confused in a table.
 */
export function formatAmount(amount: number | string, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  const digits = ["JPY", "KRW", "VND"].includes(currency) ? 0 : 2;
  return `${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${currency}`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(score: number): string {
  return Math.round(score).toString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function truncateMiddle(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${String(value)}`);
}
