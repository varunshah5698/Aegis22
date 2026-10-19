import { describe, expect, it } from "vitest";

import { defaultRiskConfig } from "@/lib/risk/config";
import { scoreWithSignals, signals } from "@/lib/risk/engine";
import { RuleBasedScorer } from "@/lib/risk/models/rule-based";
import { WeightedEnsembleScorer } from "@/lib/risk/models/weighted-ensemble";
import { MODEL_VERSION_VALUE } from "@/lib/risk/version";
import { SIGNAL_WEIGHTS, scoreToLevel } from "@/config/risk";
import type { SignalFunction } from "@/lib/risk/types";
import { makeAccount, makeContext, makeTransaction } from "../fixtures/risk";

describe("scoring engine", () => {
  it("keeps the score within 0 and 100", () => {
    const exploding: SignalFunction = () => ({
      id: "amount_threshold",
      raw: 25,
      narrative: "unbounded",
      facts: {},
    });
    const result = scoreWithSignals(makeTransaction(), makeContext(), defaultRiskConfig, [exploding]);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("normalizes weights so the score stays on a 0-100 scale", () => {
    const doubled = {
      ...defaultRiskConfig,
      weights: Object.fromEntries(
        Object.entries(SIGNAL_WEIGHTS).map(([key, value]) => [key, value * 2]),
      ) as typeof SIGNAL_WEIGHTS,
    };
    const base = scoreWithSignals(makeTransaction(), makeContext());
    const scaled = scoreWithSignals(makeTransaction(), makeContext(), doubled);
    expect(scaled.score).toBe(base.score);
  });

  it("maps score bands to levels consistently", () => {
    expect(scoreToLevel(0)).toBe("low");
    expect(scoreToLevel(40)).toBe("medium");
    expect(scoreToLevel(70)).toBe("high");
    expect(scoreToLevel(85)).toBe("critical");
  });

  it("produces an explanation even when no signal is material", () => {
    const silent: SignalFunction = () => ({
      id: "amount_threshold",
      raw: 0,
      narrative: "Nothing material.",
      facts: {},
    });
    const result = scoreWithSignals(makeTransaction(), makeContext(), defaultRiskConfig, [silent]);
    expect(result.score).toBe(0);
    expect(result.explanation.summary).toContain("No configured signal");
    expect(result.explanation.bullets).toHaveLength(0);
  });

  it("lists triggered signals as bullets with concrete narratives", () => {
    const result = scoreWithSignals(
      makeTransaction({ amountBase: 9_950 }),
      makeContext({ accounts: { "acc-a": makeAccount(), "acc-b": makeAccount({ pepFlag: true }) } }),
    );
    expect(result.explanation.bullets.length).toBeGreaterThan(0);
    expect(result.explanation.summary.length).toBeGreaterThan(40);
    expect(result.contributions.length).toBe(signals.length);
  });

  it("stamps the configured model version", () => {
    const result = scoreWithSignals(makeTransaction(), makeContext());
    expect(result.modelVersion).toBe(MODEL_VERSION_VALUE);
    expect(result.model).toBe("rule_based");
  });

  it("is deterministic for identical inputs", () => {
    const a = scoreWithSignals(makeTransaction(), makeContext());
    const b = scoreWithSignals(makeTransaction(), makeContext());
    expect(a.score).toBe(b.score);
    expect(a.explanation).toEqual(b.explanation);
  });
});

describe("scorer implementations", () => {
  it("rule-based and ensemble scorers share the same result shape", () => {
    const rule = new RuleBasedScorer().score(makeTransaction(), makeContext());
    const ensemble = new WeightedEnsembleScorer().score(makeTransaction(), makeContext());
    for (const result of [rule, ensemble]) {
      expect(result).toMatchObject({
        score: expect.any(Number),
        level: expect.any(String),
        contributions: expect.any(Array),
        explanation: expect.objectContaining({ summary: expect.any(String) }),
        modelVersion: expect.any(String),
      });
    }
    expect(rule.model).toBe("rule_based");
    expect(ensemble.model).toBe("weighted_ensemble");
  });
});

describe("performance", () => {
  it("scores 10,000 transactions in under two seconds", () => {
    const accounts: Record<string, ReturnType<typeof makeAccount>> = {};
    for (let i = 0; i < 500; i++) {
      accounts[`acc-${i}`] = makeAccount({
        id: `acc-${i}`,
        entityId: `ent-${i}`,
        openedAt: "2024-01-01T00:00:00.000Z",
        history: [],
      });
    }
    const context = makeContext({ accounts, recentTransfers: [] });
    const started = performance.now();
    let total = 0;
    for (let i = 0; i < 10_000; i++) {
      const sender = `acc-${i % 500}`;
      const receiver = `acc-${(i + 1) % 500}`;
      const result = scoreWithSignals(
        makeTransaction({
          externalId: `batch-${i}`,
          senderAccountId: sender,
          receiverAccountId: receiver,
          amountBase: 500 + (i % 5000),
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i % 60, 0)).toISOString(),
        }),
        context,
      );
      total += result.score;
    }
    const elapsed = performance.now() - started;
    expect(total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
