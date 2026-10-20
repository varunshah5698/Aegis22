import { describe, expect, it } from "vitest";

import { SCORE_BANDS, supportedCurrencies } from "@/config/risk";
import { buildDemoDataset, MAX_DEMO_DAYS, MAX_DEMO_PAYMENTS } from "@/lib/demo/generator";

const base = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  payments: 180,
  days: 60,
  now: new Date("2026-10-19T12:00:00.000Z"),
};

describe("demo dataset generator", () => {
  it("is deterministic for a seed", () => {
    const first = buildDemoDataset({ ...base, seed: 42 });
    const second = buildDemoDataset({ ...base, seed: 42 });
    expect(first.summary).toEqual(second.summary);
    expect(first.transactions[0]?.external_id).toBe(second.transactions[0]?.external_id);
  });

  it("scores every payment and keeps the rows chronological", () => {
    const dataset = buildDemoDataset({ ...base, seed: 7 });
    for (const row of dataset.transactions) {
      expect(row.risk_score).toBeGreaterThanOrEqual(0);
      expect(row.risk_score).toBeLessThanOrEqual(100);
      expect(row.risk_level).toBe(
        row.risk_score >= SCORE_BANDS.critical
          ? "critical"
          : row.risk_score >= SCORE_BANDS.high
            ? "high"
            : row.risk_score >= SCORE_BANDS.medium
              ? "medium"
              : "low",
      );
    }
    const times = dataset.transactions.map((row) => new Date(row.created_at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("generates real history, not a fresh account per payment", () => {
    const dataset = buildDemoDataset({ ...base, seed: 11 });
    const perSender = new Map<string, number>();
    for (const row of dataset.transactions) {
      perSender.set(row.sender_account_id, (perSender.get(row.sender_account_id) ?? 0) + 1);
    }
    const repeatSenders = [...perSender.values()].filter((count) => count > 4).length;
    expect(repeatSenders).toBeGreaterThan(5);
    // Later payments must be scored against earlier ones, so the window spans days.
    const span = new Date(dataset.summary.to).getTime() - new Date(dataset.summary.from).getTime();
    expect(span).toBeGreaterThan(30 * 86_400_000);
  });

  it("settles every payment in a currency the model understands", () => {
    const dataset = buildDemoDataset({ ...base, seed: 13 });
    for (const row of dataset.transactions) {
      expect(supportedCurrencies).toContain(row.currency);
      expect(row.currency).not.toBe(row.sender_country);
    }
    for (const account of dataset.accounts) {
      expect(supportedCurrencies).toContain(account.currency);
    }
  });

  it("only raises alerts for payments at or above the cutoff", () => {
    const dataset = buildDemoDataset({ ...base, seed: 3 });
    const byId = new Map(dataset.transactions.map((row) => [row.id, row]));
    expect(dataset.alerts.length).toBeGreaterThan(0);
    for (const alert of dataset.alerts) {
      const row = byId.get(alert.transaction_id);
      expect(row).toBeDefined();
      expect(row!.risk_score).toBeGreaterThanOrEqual(SCORE_BANDS.alert);
      expect(alert.severity).toBe(row!.risk_level);
    }
  });

  it("clamps caller input to the documented limits", () => {
    const dataset = buildDemoDataset({ ...base, payments: 99_999, days: 9_999, seed: 5 });
    expect(dataset.summary.payments).toBeLessThanOrEqual(MAX_DEMO_PAYMENTS + 20);
    expect(dataset.summary.days).toBe(MAX_DEMO_DAYS);
  });
});
