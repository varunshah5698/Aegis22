import { describe, expect, it } from "vitest";

import { buildFindings, type FindingsInput } from "@/lib/analytics/findings";
import type { SeriesBucket } from "@/lib/data/analytics";

function bucket(index: number, overrides: Partial<SeriesBucket> = {}): SeriesBucket {
  const count = overrides.count ?? 6;
  const value = overrides.value ?? 10_000;
  return {
    at: new Date(Date.UTC(2026, 9, 1 + index)).toISOString(),
    label: `Oct ${1 + index}`,
    count,
    value,
    flagged: 0,
    flaggedValue: 0,
    low: count,
    medium: 0,
    high: 0,
    critical: 0,
    lowValue: value,
    mediumValue: 0,
    highValue: 0,
    criticalValue: 0,
    avgScore: 18,
    ...overrides,
  };
}

function input(series: SeriesBucket[], overrides: Partial<FindingsInput> = {}): FindingsInput {
  const value = series.reduce((sum, point) => sum + point.value, 0);
  const flagged = series.reduce((sum, point) => sum + point.flagged, 0);
  return {
    range: "7d",
    bucket: "day",
    series,
    totals: { count: series.reduce((sum, point) => sum + point.count, 0), value, flagged, flaggedValue: 0, flaggedShare: 0 },
    corridors: [],
    alerts: { open: 0, unassigned: 0, breached: 0, dueSoon: 0, total: 0 },
    ...overrides,
  };
}

describe("buildFindings", () => {
  it("stays quiet on a flat series", () => {
    const findings = buildFindings(input(Array.from({ length: 8 }, (_, index) => bucket(index))));
    expect(findings).toEqual([]);
  });

  it("measures a value spike against the trailing median", () => {
    const series = Array.from({ length: 8 }, (_, index) => bucket(index));
    series[6] = bucket(6, { count: 20, value: 46_000 });
    const findings = buildFindings(input(series));
    const value = findings.find((finding) => finding.kind === "value");
    expect(value).toBeDefined();
    expect(value?.metric?.observed).toBe(46_000);
    expect(value?.metric?.baseline).toBe(10_000);
    expect(value?.metric?.deviationPct).toBeCloseTo(360, 0);
    expect(value?.severity).toBe("high");
    expect(value?.period?.label).toBe("Oct 7");
  });

  it("ignores deviations below the noise floor", () => {
    const series = Array.from({ length: 8 }, (_, index) => bucket(index, { count: 2, value: 900, lowValue: 900 }));
    series[5] = bucket(5, { count: 3, value: 1_400, lowValue: 1_400 });
    const findings = buildFindings(input(series));
    expect(findings.filter((finding) => finding.kind === "value" || finding.kind === "count")).toEqual([]);
  });

  it("flags a trailing ingestion gap instead of reading it as calm", () => {
    const series = Array.from({ length: 8 }, (_, index) => bucket(index, { count: index >= 6 ? 0 : 6, value: index >= 6 ? 0 : 10_000 }));
    const findings = buildFindings(input(series));
    const gap = findings.find((finding) => finding.kind === "gap");
    expect(gap).toBeDefined();
    expect(gap?.severity).toBe("high");
    expect(gap?.title).toContain("2 periods");
  });

  it("raises the unassigned backlog when every open alert lacks an owner", () => {
    const findings = buildFindings(
      input(Array.from({ length: 8 }, (_, index) => bucket(index)), {
        alerts: { open: 40, unassigned: 40, breached: 2, dueSoon: 5, total: 40 },
      }),
    );
    const backlog = findings.find((finding) => finding.kind === "backlog");
    expect(backlog).toBeDefined();
    expect(backlog?.severity).toBe("critical");
  });

  it("surfaces corridor concentration with its measured share", () => {
    const findings = buildFindings(
      input(Array.from({ length: 8 }, (_, index) => bucket(index)), {
        corridors: [{ corridor: "AE-IN", count: 23, value: 80_000, flagged: 2, avgScore: 41 }],
      }),
    );
    const concentration = findings.find((finding) => finding.kind === "concentration");
    expect(concentration).toBeDefined();
    expect(concentration?.metric?.deviationPct).toBeCloseTo(100, 0);
    expect(concentration?.href).toContain("corridor=AE-IN");
  });

  it("orders critical findings before medium ones", () => {
    const series = Array.from({ length: 8 }, (_, index) => bucket(index));
    series[6] = bucket(6, { flagged: 6, count: 9 });
    const findings = buildFindings(
      input(series, {
        alerts: { open: 10, unassigned: 10, breached: 0, dueSoon: 0, total: 10 },
      }),
    );
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.kind).toBe("flagged");
  });
});
