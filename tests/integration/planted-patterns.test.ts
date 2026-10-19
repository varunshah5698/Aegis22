import { beforeAll, describe, expect, it } from "vitest";

import { SCORE_BANDS } from "@/config/risk";

import { buildNorthwindDataset, scoreDataset, type ScoredTransaction } from "../../scripts/seed";

/**
 * These assertions run the production scoring engine over the exact dataset the
 * seed writes to Postgres. They are the contract between the detection model and
 * the demo: every documented typology must raise at least one alert, and normal
 * traffic must stay inside the documented false-positive budget.
 */

const FALSE_POSITIVE_BUDGET = 0.03;

let scored: ScoredTransaction[];

beforeAll(() => {
  scored = scoreDataset(buildNorthwindDataset());
}, 120_000);

function planted(prefix: string): ScoredTransaction[] {
  return scored.filter((value) => value.planted?.startsWith(prefix));
}

function flagged(prefix: string): ScoredTransaction[] {
  return planted(prefix).filter((value) => value.score >= SCORE_BANDS.alert);
}

describe("planted typologies", () => {
  it("scores the full dataset deterministically", () => {
    const again = scoreDataset(buildNorthwindDataset());
    expect(again).toHaveLength(scored.length);
    const sample = scored.slice(0, 500);
    const resample = again.slice(0, 500);
    sample.forEach((value, index) => {
      expect(resample[index]!.score).toBe(value.score);
      expect(resample[index]!.level).toBe(value.level);
    });
  });

  it("raises an alert for every structuring cluster", () => {
    for (const cluster of [1, 2, 3]) {
      const hits = flagged(`splitting_cluster_${cluster}`);
      expect(hits.length, `cluster ${cluster}`).toBeGreaterThan(0);
      const [hit] = hits;
      expect(hit!.score).toBeGreaterThanOrEqual(SCORE_BANDS.alert);
      const splitting = hit!.contributions.find((item) => item.id === "splitting_window");
      expect(splitting?.triggered).toBe(true);
      expect(splitting?.facts.related_accounts).toBeGreaterThanOrEqual(2);
    }
  });

  it("raises an alert for both circular flows", () => {
    for (const loop of [1, 2]) {
      const hits = flagged(`circular_flow_${loop}`);
      expect(hits.length, `loop ${loop}`).toBeGreaterThan(0);
      const circular = hits[0]!.contributions.find((item) => item.id === "circular_path");
      expect(circular?.triggered).toBe(true);
    }
  });

  it("raises an alert for every shell intermediary", () => {
    for (const shell of [1, 2, 3, 4]) {
      const rows = planted(`shell_intermediary_${shell}`);
      const hits = flagged(`shell_intermediary_${shell}`);
      expect(hits.length, `shell ${shell}`).toBeGreaterThan(0);
      const shellSignal = hits[0]!.contributions.find((item) => item.id === "shell_intermediary");
      expect(shellSignal?.triggered).toBe(true);
      // The forwarding leg is what proves the pass-through, so at least one
      // transaction in the shell's planted sequence must show it.
      const ratios = rows.map((row) =>
        Number(row.contributions.find((item) => item.id === "shell_intermediary")?.facts.pass_through_ratio ?? 0),
      );
      expect(Math.max(...ratios), `shell ${shell} pass-through`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("raises alerts for both corridor spikes", () => {
    for (const spike of [1, 2]) {
      const hits = flagged(`corridor_spike_${spike}`);
      expect(hits.length, `spike ${spike}`).toBeGreaterThan(10);
    }
  });

  it("raises alerts for first-time high-risk corridors", () => {
    const hits = flagged("first_time_corridor_");
    expect(hits.length).toBeGreaterThanOrEqual(6);
    // The signal fires on the account's first restricted-corridor transfer; the
    // alert itself lands on a later transfer once the cluster is complete.
    const firstTime = planted("first_time_corridor_").flatMap((value) =>
      value.contributions.filter((item) => item.id === "first_time_corridor" && item.triggered),
    );
    expect(firstTime.length).toBeGreaterThanOrEqual(20);
    hits.forEach((hit) => expect(hit.score).toBeGreaterThanOrEqual(SCORE_BANDS.alert));
  });

  it("keeps normal traffic inside the documented false-positive budget", () => {
    const normal = scored.filter((value) => !value.planted);
    const falsePositives = normal.filter((value) => value.score >= SCORE_BANDS.alert);
    const rate = falsePositives.length / normal.length;
    expect(rate).toBeLessThanOrEqual(FALSE_POSITIVE_BUDGET);
  });

  it("flags fewer than 1.5 percent of all seeded traffic", () => {
    const alerts = scored.filter((value) => value.score >= SCORE_BANDS.alert);
    expect(alerts.length / scored.length).toBeLessThan(0.015);
  });
});
