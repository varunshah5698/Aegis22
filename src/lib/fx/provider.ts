import "server-only";

/**
 * Server-side FX provider abstraction.
 *
 * The workspace ships with Frankfurter (European Central Bank reference rates)
 * because it needs no credentials and is reproducible. Any other provider is
 * plugged in by adding an adapter below and selecting it with FX_PROVIDER; the
 * page and API route never talk to a vendor directly, so swapping providers
 * never touches UI code.
 *
 * Data honesty rules enforced here:
 *  - every response carries its source, the rate date and whether it is delayed;
 *  - reference rates are never labelled live;
 *  - currencies the provider does not publish are reported as unsupported
 *    rather than guessed from a cross-rate.
 */

export type FxErrorCode =
  | "not_configured"
  | "unavailable"
  | "unsupported_currency"
  | "unsupported_base"
  | "rate_limited";

export class FxError extends Error {
  readonly code: FxErrorCode;

  constructor(code: FxErrorCode, message: string) {
    super(message);
    this.name = "FxError";
    this.code = code;
  }
}

export interface FxSource {
  id: string;
  label: string;
  /** "reference" is a published fixing, "live" is a streaming quote. */
  kind: "reference" | "live";
  /** True when the provider publishes less often than intraday. */
  delayed: boolean;
  url: string;
  note: string;
}

export interface FxLatest {
  base: string;
  /** Date the provider attributes the rate to, not the request date. */
  rateDate: string;
  fetchedAt: string;
  source: FxSource;
  /** Quote currency → units of that currency per one unit of `base`. */
  rates: Record<string, number>;
  unsupported: string[];
}

export interface FxHistoryPoint {
  date: string;
  rates: Record<string, number>;
}

export interface FxHistory {
  base: string;
  symbols: string[];
  points: FxHistoryPoint[];
  source: FxSource;
  fetchedAt: string;
}

export const frankfurterSource: FxSource = {
  id: "frankfurter",
  label: "Frankfurter · ECB reference rates",
  kind: "reference",
  delayed: true,
  url: "https://frankfurter.dev",
  note: "European Central Bank reference rates, published once per working day at around 16:00 CET. Weekends and public holidays reuse the previous working day's fixing, so this is not a live market quote.",
};

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";
const REQUEST_TIMEOUT_MS = 8_000;
/** Rates move on a daily cadence at most, so an hour of caching is generous. */
const LATEST_REVALIDATE_SECONDS = 3_600;
const HISTORY_REVALIDATE_SECONDS = 21_600;

export interface FxProviderConfig {
  id: string;
  /** True when the selected provider needs FX_API_KEY. */
  requiresKey: boolean;
  hasKey: boolean;
  baseUrl: string | null;
  source: FxSource;
}

/**
 * Reads the selected provider from the environment. Only Frankfurter is bundled,
 * so any other value fails loudly instead of silently returning canned numbers.
 */
export function getFxProviderConfig(): FxProviderConfig {
  const id = (process.env.FX_PROVIDER ?? "frankfurter").trim().toLowerCase() || "frankfurter";
  const hasKey = Boolean(process.env.FX_API_KEY);
  const baseUrl = process.env.FX_BASE_URL?.trim() || null;

  if (id !== "frankfurter") {
    return {
      id,
      requiresKey: true,
      hasKey,
      baseUrl,
      source: {
        id,
        label: `${id} (no adapter installed)`,
        kind: "live",
        delayed: false,
        url: baseUrl ?? "",
        note: `FX_PROVIDER is set to "${id}" but this build only ships the Frankfurter adapter. Add an adapter in src/lib/fx/provider.ts to use it.`,
      },
    };
  }

  return { id, requiresKey: false, hasKey, baseUrl, source: frankfurterSource };
}

async function frankfurter<T>(path: string, revalidate: number): Promise<T> {
  const config = getFxProviderConfig();
  if (config.id !== "frankfurter") {
    throw new FxError("not_configured", config.source.note);
  }

  let response: Response;
  try {
    response = await fetch(`${FRANKFURTER_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    throw new FxError("unavailable", `FX provider unreachable: ${reason}`);
  }

  if (response.status === 429) {
    throw new FxError("rate_limited", "The FX provider is rate limiting this workspace. Try again shortly.");
  }
  if (response.status === 404) {
    throw new FxError("unsupported_currency", "The provider has no rates for that currency or date range.");
  }
  if (!response.ok) {
    throw new FxError("unavailable", `FX provider responded with ${response.status}.`);
  }

  return (await response.json()) as T;
}

/** Currencies the provider actually publishes. Cached for a day. */
export async function getFxCurrencyNames(): Promise<Record<string, string>> {
  return frankfurter<Record<string, string>>("/currencies", 86_400);
}

export async function getLatestRates(base: string, symbols: string[]): Promise<FxLatest> {
  const codes = symbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => symbol !== base.toUpperCase());
  const supported = await getFxCurrencyNames().catch(() => ({}) as Record<string, string>);
  const known = Object.keys(supported);

  if (known.length > 0 && !known.includes(base.toUpperCase())) {
    throw new FxError("unsupported_base", `${base} is not published by ${frankfurterSource.label}.`);
  }

  const requested = codes.filter((code) => known.length === 0 || known.includes(code));
  const unsupported = codes.filter((code) => !requested.includes(code));
  const query = requested.length > 0 ? `&symbols=${requested.join(",")}` : "";

  const payload = await frankfurter<{ base: string; date: string; rates: Record<string, number> }>(
    `/latest?base=${encodeURIComponent(base.toUpperCase())}${query}`,
    LATEST_REVALIDATE_SECONDS,
  );

  return {
    base: payload.base,
    rateDate: payload.date,
    fetchedAt: new Date().toISOString(),
    source: frankfurterSource,
    rates: payload.rates,
    unsupported,
  };
}

export async function getRateHistory(
  base: string,
  symbols: string[],
  from: Date,
  to: Date,
): Promise<FxHistory> {
  const codes = symbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => symbol !== base.toUpperCase());
  const start = from.toISOString().slice(0, 10);
  const end = to.toISOString().slice(0, 10);
  const query = codes.length > 0 ? `&symbols=${codes.join(",")}` : "";

  const payload = await frankfurter<{
    base: string;
    rates: Record<string, Record<string, number>>;
  }>(`/${start}..${end}?base=${encodeURIComponent(base.toUpperCase())}${query}`, HISTORY_REVALIDATE_SECONDS);

  const points = Object.entries(payload.rates)
    .map(([date, rates]) => ({ date, rates: rates ?? {} }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    base: payload.base,
    symbols: codes,
    points,
    source: frankfurterSource,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Converts an amount using a published rate. Kept in one place so Overview,
 * Analytics and Transactions can never disagree about a conversion.
 */
export function convert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** Percentage change between two published rates. */
export function changePercent(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0) return 0;
  return ((to - from) / from) * 100;
}
