import { fail, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth";
import { FxError, getFxProviderConfig, getLatestRates, getRateHistory } from "@/lib/fx/provider";

export const runtime = "nodejs";

const CURRENCY = /^[A-Za-z]{3}$/;

function parseSymbols(value: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter((item) => CURRENCY.test(item)))].slice(
    0,
    24,
  );
}

/**
 * GET /api/fx?base=USD&symbols=EUR,GBP[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Rates are cached server-side by the provider layer, so this route never
 * proxies traffic straight through to the vendor. Responses always include the
 * source and the rate date so the client can show attribution.
 */
export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to read FX rates.", { status: 401 });

  const url = new URL(request.url);
  const base = (url.searchParams.get("base") ?? "USD").toUpperCase();
  if (!CURRENCY.test(base)) return fail("invalid_base", "Base currency must be a three letter ISO code.", { status: 400 });

  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    if (from && to) {
      const start = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return fail("invalid_range", "History needs from and to dates in YYYY-MM-DD form.", { status: 400 });
      }
      if (end.getTime() < start.getTime()) {
        return fail("invalid_range", "The end date must not be earlier than the start date.", { status: 400 });
      }
      // One year is the longest window the provider documents; anything larger
      // is almost always a client bug rather than an intended query.
      if (end.getTime() - start.getTime() > 366 * 86_400_000) {
        return fail("invalid_range", "History windows are limited to 366 days.", { status: 400 });
      }
      const history = await getRateHistory(base, symbols, start, end);
      return ok({ kind: "history", history });
    }

    const latest = await getLatestRates(base, symbols);
    return ok({ kind: "latest", latest });
  } catch (error) {
    if (error instanceof FxError) {
      const status = error.code === "unavailable" ? 502 : error.code === "rate_limited" ? 429 : 400;
      return fail(error.code, error.message, { status, details: { provider: getFxProviderConfig().source } });
    }
    return fail("provider_error", "The FX provider request failed.", { status: 502 });
  }
}
