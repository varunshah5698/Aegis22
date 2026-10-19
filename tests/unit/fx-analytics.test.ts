import { describe, expect, it } from "vitest";

import {
  annualizedVolatility,
  correlation,
  correlationMatrix,
  exposureSensitivity,
  logReturns,
  maxDrawdown,
  oneDayMovePercent,
  periodChange,
  rangePosition,
  standardDeviation,
} from "@/lib/fx/analytics";

/** Builds a deterministic series from a starting rate and daily percentages. */
function series(start: number, moves: number[], from = 1): Array<{ date: string; rate: number }> {
  let rate = start;
  return [
    { date: `2026-09-${String(from).padStart(2, "0")}`, rate },
    ...moves.map((move, index) => {
      rate = rate * (1 + move);
      return { date: `2026-10-${String(index + 1).padStart(2, "0")}`, rate };
    }),
  ];
}

describe("fx analytics", () => {
  it("computes log returns between consecutive fixings", () => {
    const returns = logReturns([
      { date: "2026-10-01", rate: 1 },
      { date: "2026-10-02", rate: 2 },
      { date: "2026-10-05", rate: 1 },
    ]);
    expect(returns).toHaveLength(2);
    expect(returns[0]!.value).toBeCloseTo(Math.log(2), 10);
    expect(returns[1]!.value).toBeCloseTo(Math.log(0.5), 10);
    // Zero and negative rates are dropped rather than turned into NaN.
    expect(logReturns([{ date: "2026-10-01", rate: 0 }])).toEqual([]);
  });

  it("uses the sample standard deviation", () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(standardDeviation([1])).toBeNull();
  });

  it("annualises volatility from daily returns", () => {
    const stable = series(1, [0.001, -0.001, 0.001, -0.001, 0.001, -0.001]);
    const volatile = series(1, [0.02, -0.02, 0.02, -0.02, 0.02, -0.02]);
    const stableVol = annualizedVolatility(stable);
    const volatileVol = annualizedVolatility(volatile);
    expect(stableVol).not.toBeNull();
    expect(volatileVol).not.toBeNull();
    expect(volatileVol!).toBeGreaterThan(stableVol! * 10);
    expect(annualizedVolatility(series(1, [0.01]))).toBeNull();
  });

  it("measures period change and range position", () => {
    const points = [
      { date: "2026-10-01", rate: 1 },
      { date: "2026-10-02", rate: 1.2 },
      { date: "2026-10-05", rate: 1.1 },
    ];
    expect(periodChange(points)).toBeCloseTo(10, 10);
    const range = rangePosition(points)!;
    expect(range.low).toBe(1);
    expect(range.high).toBe(1.2);
    expect(range.position).toBeCloseTo(0.5, 10);
  });

  it("reports drawdown as a positive percentage", () => {
    const points = [
      { date: "2026-10-01", rate: 2 },
      { date: "2026-10-02", rate: 2.4 },
      { date: "2026-10-05", rate: 1.8 },
      { date: "2026-10-06", rate: 1.9 },
    ];
    expect(maxDrawdown(points)).toBeCloseTo(25, 10);
    expect(maxDrawdown([{ date: "2026-10-01", rate: 1 }])).toBeNull();
  });

  it("correlates aligned returns and rejects short overlap", () => {
    const a = series(1, [0.01, 0.02, -0.01, 0.03, -0.02, 0.015]);
    const b = series(1, [0.011, 0.019, -0.012, 0.028, -0.018, 0.016]);
    expect(correlation(a, b)).toBeGreaterThan(0.99);
    const inverse = series(1, [-0.01, -0.02, 0.01, -0.03, 0.02, -0.015]);
    expect(correlation(a, inverse)).toBeLessThan(-0.99);
    expect(correlation(a, series(1, [0.01, 0.02]))).toBeNull();
  });

  it("builds a symmetric matrix with a unit diagonal", () => {
    const a = series(1, [0.01, 0.02, -0.01, 0.03, -0.02, 0.015]);
    const b = series(1, [0.011, 0.019, -0.012, 0.028, -0.018, 0.016]);
    const matrix = correlationMatrix([
      { code: "EUR", points: a },
      { code: "GBP", points: b },
    ]);
    expect(matrix.codes).toEqual(["EUR", "GBP"]);
    expect(matrix.values[0]![0]).toBe(1);
    expect(matrix.values[1]![1]).toBe(1);
    expect(matrix.values[0]![1]).toBeCloseTo(matrix.values[1]![0]!, 10);
  });

  it("derives the parametric one-day move and exposure impact", () => {
    const move = oneDayMovePercent(10)!;
    expect(move).toBeCloseTo((10 / Math.sqrt(252)) * 1.6449, 6);

    const exposure = exposureSensitivity(
      [
        { currency: "EUR", value: 1_000_000, count: 40 },
        { currency: "AED", value: 500_000, count: 10 },
        { currency: "USD", value: 2_000_000, count: 100 },
      ],
      { EUR: 10, AED: null },
    );

    const eur = exposure.rows.find((row) => row.currency === "EUR")!;
    expect(eur.impact).toBeCloseTo(1_000_000 * (move / 100), 4);
    const aed = exposure.rows.find((row) => row.currency === "AED")!;
    expect(aed.unpriced).toBe(true);
    expect(aed.impact).toBeNull();
    const usd = exposure.rows.find((row) => row.currency === "USD")!;
    expect(usd.impact).toBe(0);
    expect(exposure.unpricedValue).toBe(500_000);
    expect(exposure.pricedValue).toBe(3_000_000);
    expect(exposure.rows[0]!.currency).toBe("EUR");
  });
});
