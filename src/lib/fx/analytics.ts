/**
 * FX statistics computed from published fixings.
 *
 * Everything here is descriptive: annualised volatility, drawdown, range
 * position, pairwise correlation and a parametric one-day exposure estimate.
 * No function invents a rate, fills a missing fixing or converts through a
 * cross-rate it was not given. Series that are too short return `null` rather
 * than a default, so the UI can say "not enough fixings" instead of showing a
 * number that looks measured.
 */

export interface FxPoint {
  date: string;
  rate: number;
}

export interface FxPointSeries {
  code: string;
  points: FxPoint[];
}

/** Trading days in a year, used to annualise daily fixings. */
export const TRADING_DAYS = 252;

function finitePoints(points: FxPoint[]): FxPoint[] {
  return points.filter((point) => Number.isFinite(point.rate) && point.rate > 0);
}

/** Natural-log returns between consecutive fixings, keyed by the later date. */
export function logReturns(points: FxPoint[]): Array<{ date: string; value: number }> {
  const clean = finitePoints(points);
  const returns: Array<{ date: string; value: number }> = [];
  for (let index = 1; index < clean.length; index += 1) {
    const previous = clean[index - 1]!;
    const current = clean[index]!;
    returns.push({ date: current.date, value: Math.log(current.rate / previous.rate) });
  }
  return returns;
}

/** Sample standard deviation (`n - 1`). */
export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Annualised volatility of daily fixings, in percent. ECB fixings skip
 * weekends, so 252 trading days is the right annualisation for this provider.
 */
export function annualizedVolatility(points: FxPoint[], window?: number): number | null {
  const returns = logReturns(points);
  const sliced = typeof window === "number" ? returns.slice(-window) : returns;
  if (sliced.length < 3) return null;
  const deviation = standardDeviation(sliced.map((entry) => entry.value));
  if (deviation === null) return null;
  return deviation * Math.sqrt(TRADING_DAYS) * 100;
}

/** Percentage change between the first and last fixing in the window. */
export function periodChange(points: FxPoint[]): number | null {
  const clean = finitePoints(points);
  if (clean.length < 2) return null;
  const first = clean[0]!.rate;
  const last = clean[clean.length - 1]!.rate;
  return ((last - first) / first) * 100;
}

export interface RangePosition {
  low: number;
  high: number;
  latest: number;
  /** 0 = at the low of the window, 1 = at the high. */
  position: number;
}

/** Where the latest fixing sits inside the window's low–high band. */
export function rangePosition(points: FxPoint[]): RangePosition | null {
  const clean = finitePoints(points);
  if (clean.length < 2) return null;
  const rates = clean.map((point) => point.rate);
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  const latest = rates[rates.length - 1]!;
  const span = high - low;
  return {
    low,
    high,
    latest,
    position: span > 0 ? (latest - low) / span : 0.5,
  };
}

/**
 * Largest peak-to-trough decline in percent over the window. Reported as a
 * positive number so it reads as the size of the drawdown.
 */
export function maxDrawdown(points: FxPoint[]): number | null {
  const clean = finitePoints(points);
  if (clean.length < 2) return null;
  let peak = clean[0]!.rate;
  let worst = 0;
  for (const point of clean) {
    if (point.rate > peak) peak = point.rate;
    const decline = ((peak - point.rate) / peak) * 100;
    if (decline > worst) worst = decline;
  }
  return worst;
}

/**
 * Pearson correlation of two series' daily log returns, aligned on shared
 * fixing dates. Needs at least five overlapping returns, otherwise `null`.
 */
export function correlation(a: FxPoint[], b: FxPoint[]): number | null {
  const returnsB = new Map(logReturns(b).map((entry) => [entry.date, entry.value] as const));
  const pairs: Array<[number, number]> = [];
  for (const entry of logReturns(a)) {
    const other = returnsB.get(entry.date);
    if (typeof other === "number") pairs.push([entry.value, other]);
  }
  if (pairs.length < 5) return null;

  const meanA = pairs.reduce((total, [value]) => total + value, 0) / pairs.length;
  const meanB = pairs.reduce((total, [, value]) => total + value, 0) / pairs.length;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (const [valueA, valueB] of pairs) {
    covariance += (valueA - meanA) * (valueB - meanB);
    varianceA += (valueA - meanA) ** 2;
    varianceB += (valueB - meanB) ** 2;
  }
  if (varianceA === 0 || varianceB === 0) return null;
  return covariance / Math.sqrt(varianceA * varianceB);
}

export interface FxCorrelationMatrix {
  codes: string[];
  /** values[row][column]; 1 on the diagonal, `null` where overlap is too short. */
  values: Array<Array<number | null>>;
}

export function correlationMatrix(series: FxPointSeries[]): FxCorrelationMatrix {
  const codes = series.map((entry) => entry.code);
  const values = series.map((row) => series.map((column) => (row.code === column.code ? 1 : correlation(row.points, column.points))));
  return { codes, values };
}

/**
 * Quantile of the standard normal distribution for the usual confidence
 * levels. Kept explicit rather than pulling in a statistics dependency.
 */
export function zScore(confidence: number): number | null {
  if (confidence === 0.9) return 1.2816;
  if (confidence === 0.95) return 1.6449;
  if (confidence === 0.99) return 2.3263;
  return null;
}

/**
 * Parametric one-day move, in percent, at the given confidence: daily
 * volatility (annualised ÷ √252) × z. Purely indicative — it assumes normal
 * returns and ignores fat tails and correlations between currencies.
 */
export function oneDayMovePercent(annualizedVolPercent: number | null, confidence = 0.95): number | null {
  const z = zScore(confidence);
  if (annualizedVolPercent === null || !Number.isFinite(annualizedVolPercent) || z === null) return null;
  return (annualizedVolPercent / Math.sqrt(TRADING_DAYS)) * z;
}

export interface ExposureEntry {
  currency: string;
  /** Screened value in USD for the window. */
  value: number;
  count: number;
}

export interface ExposureSensitivityRow {
  currency: string;
  value: number;
  count: number;
  annualizedVolPercent: number | null;
  oneDayMovePercent: number | null;
  /** Absolute USD impact of a one-day move at the chosen confidence. */
  impact: number | null;
  /** True when the provider publishes no fixing for the currency. */
  unpriced: boolean;
}

export interface ExposureSensitivity {
  rows: ExposureSensitivityRow[];
  totalImpact: number;
  pricedValue: number;
  unpricedValue: number;
  confidence: number;
}

/**
 * Translation sensitivity of the USD-converted book: each currency's screened
 * value multiplied by its own one-day parametric move. The sum treats moves as
 * independent, so it is a sizing aid rather than a portfolio VaR figure.
 */
export function exposureSensitivity(
  entries: ExposureEntry[],
  volatilityByCurrency: Record<string, number | null>,
  confidence = 0.95,
): ExposureSensitivity {
  const rows = entries
    .map((entry) => {
      const vol = entry.currency === "USD" ? 0 : (volatilityByCurrency[entry.currency] ?? null);
      const move = vol === null ? null : oneDayMovePercent(vol, confidence);
      return {
        currency: entry.currency,
        value: entry.value,
        count: entry.count,
        annualizedVolPercent: vol,
        oneDayMovePercent: move,
        impact: move === null ? null : Math.abs(entry.value * (move / 100)),
        unpriced: entry.currency !== "USD" && vol === null,
      };
    })
    .sort((a, b) => (b.impact ?? -1) - (a.impact ?? -1) || b.value - a.value);

  return {
    rows,
    totalImpact: rows.reduce((total, row) => total + (row.impact ?? 0), 0),
    pricedValue: rows.reduce((total, row) => total + (row.impact === null ? 0 : row.value), 0),
    unpricedValue: rows.filter((row) => row.unpriced).reduce((total, row) => total + row.value, 0),
    confidence,
  };
}

/** Distinct fixing dates shared by every series, used to align comparisons. */
export function commonDates(series: FxPointSeries[]): string[] {
  if (series.length === 0) return [];
  const [first, ...rest] = series;
  const others = rest.map((entry) => new Set(entry.points.map((point) => point.date)));
  return first!.points
    .map((point) => point.date)
    .filter((date) => others.every((set) => set.has(date)))
    .sort((a, b) => a.localeCompare(b));
}
