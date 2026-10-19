import { describe, expect, it } from "vitest";

import { amountThresholdSignal } from "@/lib/risk/signals/amount-threshold";
import { velocitySignal } from "@/lib/risk/signals/velocity";
import { highRiskCorridorSignal } from "@/lib/risk/signals/high-risk-corridor";
import { newCounterpartySignal } from "@/lib/risk/signals/new-counterparty";
import { splittingWindowSignal } from "@/lib/risk/signals/splitting-window";
import { circularPathSignal } from "@/lib/risk/signals/circular-path";
import { shellIntermediarySignal } from "@/lib/risk/signals/shell-intermediary";
import { firstTimeCorridorSignal } from "@/lib/risk/signals/first-time-corridor";
import { currencyMismatchSignal } from "@/lib/risk/signals/currency-mismatch";
import { pepExposureSignal } from "@/lib/risk/signals/pep-exposure";
import { defaultRiskConfig } from "@/lib/risk/config";
import {
  edge,
  inbound,
  makeAccount,
  makeContext,
  makeTransaction,
  outbound,
  BASE_TIME,
} from "../fixtures/risk";

const day = (offset: number) =>
  new Date(new Date(BASE_TIME).getTime() - offset * 86_400_000).toISOString();
const hour = (offset: number) =>
  new Date(new Date(BASE_TIME).getTime() - offset * 3_600_000).toISOString();

describe("amount threshold signal", () => {
  it("scores a payment just under the threshold as maximum", () => {
    const result = amountThresholdSignal(makeTransaction({ amountBase: 9_850 }), makeContext());
    expect(result.raw).toBe(1);
    expect(result.narrative).toContain("10,000");
  });

  it("scores an ordinary payment as zero", () => {
    const result = amountThresholdSignal(makeTransaction({ amountBase: 1_250 }), makeContext());
    expect(result.raw).toBe(0);
  });

  it("treats the exact threshold as material", () => {
    const result = amountThresholdSignal(makeTransaction({ amountBase: 10_000 }), makeContext());
    expect(result.raw).toBe(1);
    expect(result.facts.ratio).toBe(1);
  });
});

describe("velocity signal", () => {
  // Daily activity that stops 48 hours before the transaction under test.
  const baselineHistory = Array.from({ length: 60 }, (_, index) =>
    outbound("acc-x", 5_000, day(index + 2)),
  );

  it("flags a burst well above the 90-day baseline", () => {
    const history = [
      ...baselineHistory,
      ...Array.from({ length: 12 }, (_, index) => outbound("acc-x", 4_000, hour(index + 1))),
    ];
    const result = velocitySignal(
      makeTransaction({ amountBase: 9_000 }),
      makeContext({
        accounts: { "acc-a": makeAccount({ history }), "acc-b": makeAccount() },
      }),
    );
    expect(result.raw).toBeGreaterThan(0.6);
    expect(result.narrative).toContain("24 hours");
  });

  it("stays quiet when activity matches the baseline", () => {
    const history = [...baselineHistory, outbound("acc-x", 400, hour(2))];
    const result = velocitySignal(
      makeTransaction({ amountBase: 450 }),
      makeContext({
        accounts: { "acc-a": makeAccount({ history }), "acc-b": makeAccount() },
      }),
    );
    expect(result.raw).toBe(0);
  });

  it("applies a modest score when there is not enough history to judge", () => {
    const history = Array.from({ length: 4 }, () => outbound("acc-x", 300, hour(1)));
    const result = velocitySignal(
      makeTransaction({ amountBase: 500 }),
      makeContext({
        accounts: { "acc-a": makeAccount({ history }), "acc-b": makeAccount() },
      }),
    );
    expect(result.raw).toBe(0.5);
    expect(result.facts.baseline_transactions_90d).toBe(4);
  });
});

describe("high-risk corridor signal", () => {
  it("scores a critical corridor at maximum", () => {
    const result = highRiskCorridorSignal(
      makeTransaction({ senderCountry: "IR", receiverCountry: "US" }),
      makeContext(),
    );
    expect(result.raw).toBe(1);
    expect(result.facts.tier).toBe("critical");
  });

  it("scores a standard corridor low", () => {
    const result = highRiskCorridorSignal(makeTransaction(), makeContext());
    expect(result.raw).toBeLessThan(0.1);
  });

  it("scores an elevated corridor in the middle", () => {
    const result = highRiskCorridorSignal(
      makeTransaction({ senderCountry: "AE", receiverCountry: "IN" }),
      makeContext(),
    );
    expect(result.raw).toBe(0.5);
  });
});

describe("new counterparty signal", () => {
  it("flags a receiver never seen in 180 days", () => {
    const result = newCounterpartySignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: [outbound("other", 100, day(10))] }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0.75);
  });

  it("does not flag a known counterparty", () => {
    const result = newCounterpartySignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: [outbound("acc-b", 100, day(10))] }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0);
  });

  it("treats a brand-new sender as high risk", () => {
    const result = newCounterpartySignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ openedAt: day(3) }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(1);
  });
});

describe("splitting window signal", () => {
  const cluster = [
    outbound("acc-b", 1_800, hour(1), { externalId: "s1" }),
    outbound("acc-b", 1_700, hour(2), { externalId: "s2" }),
    outbound("acc-b", 1_900, hour(3), { externalId: "s3" }),
    outbound("acc-b", 1_600, hour(4), { externalId: "s4" }),
  ];
  const relatedCluster = [
    outbound("acc-b", 1_850, hour(2), { externalId: "s5" }),
    outbound("acc-b", 1_750, hour(3), { externalId: "s6" }),
    outbound("acc-b", 1_950, hour(5), { externalId: "s7" }),
  ];

  it("flags a 7-transaction cluster crossing the threshold", () => {
    const result = splittingWindowSignal(
      makeTransaction({ amountBase: 1_850, externalId: "s8" }),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: cluster }),
          "acc-rel": makeAccount({ id: "acc-rel", history: relatedCluster }),
          "acc-b": makeAccount(),
        },
        relatedAccounts: { "acc-a": ["acc-rel"], "acc-rel": ["acc-a"] },
      }),
    );
    expect(result.raw).toBeGreaterThan(0.6);
    expect(result.facts.related_accounts).toBe(2);
    expect(result.narrative).toContain("related accounts");
  });

  it("ignores a two-transaction pair", () => {
    const result = splittingWindowSignal(
      makeTransaction({ amountBase: 1_850 }),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: cluster.slice(0, 1) }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0);
  });

  it("stays below the threshold even for many small payments", () => {
    const small = Array.from({ length: 7 }, (_, index) =>
      outbound("acc-b", 900, hour(index + 1)),
    );
    const result = splittingWindowSignal(
      makeTransaction({ amountBase: 900, externalId: "boundary" }),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: small }),
          "acc-rel": makeAccount({ id: "acc-rel" }),
          "acc-b": makeAccount(),
        },
        relatedAccounts: { "acc-a": ["acc-rel"], "acc-rel": ["acc-a"] },
      }),
    );
    expect(result.raw).toBe(0);
  });
});

describe("circular path signal", () => {
  it("detects a four-hop loop with value decay", () => {
    const context = makeContext({
      accounts: {
        "acc-a": makeAccount(),
        "acc-b": makeAccount({ id: "acc-b", entityName: "Beta Trading" }),
        "acc-c": makeAccount({ id: "acc-c", entityName: "Gamma Holdings" }),
        "acc-d": makeAccount({ id: "acc-d", entityName: "Delta Partners" }),
      },
      recentTransfers: [
        edge("acc-a", "acc-b", 10_000, hour(5)),
        edge("acc-b", "acc-c", 9_700, hour(4)),
        edge("acc-c", "acc-d", 9_400, hour(3)),
        edge("acc-d", "acc-a", 9_100, hour(2)),
      ],
    });
    const result = circularPathSignal(
      makeTransaction({
        externalId: "loop-1",
        amountBase: 10_000,
        senderAccountId: "acc-a",
        receiverAccountId: "acc-b",
      }),
      context,
    );
    expect(result.raw).toBe(1);
    expect(result.facts.hops).toBe(4);
    expect(result.narrative).toContain("loop");
  });

  it("returns zero when the chain does not close", () => {
    const result = circularPathSignal(
      makeTransaction({ amountBase: 10_000 }),
      makeContext({
        accounts: {
          "acc-a": makeAccount(),
          "acc-b": makeAccount({ id: "acc-b" }),
          "acc-c": makeAccount({ id: "acc-c" }),
        },
        recentTransfers: [
          edge("acc-a", "acc-b", 10_000, hour(5)),
          edge("acc-b", "acc-c", 9_700, hour(4)),
        ],
      }),
    );
    expect(result.raw).toBe(0);
  });

  it("rejects a loop that loses more than 10% per hop", () => {
    const result = circularPathSignal(
      makeTransaction({ amountBase: 10_000, externalId: "loop-decay" }),
      makeContext({
        accounts: {
          "acc-a": makeAccount(),
          "acc-b": makeAccount({ id: "acc-b" }),
          "acc-c": makeAccount({ id: "acc-c" }),
        },
        recentTransfers: [
          edge("acc-a", "acc-b", 10_000, hour(5)),
          edge("acc-b", "acc-c", 8_000, hour(4)),
          edge("acc-c", "acc-a", 7_500, hour(3)),
        ],
      }),
    );
    expect(result.raw).toBe(0);
  });
});

describe("shell intermediary signal", () => {
  const shellAccount = makeAccount({
    id: "acc-b",
    entityName: "Horizon Trade FZE",
    incorporatedOn: "2026-06-01",
    nomineeEntityCount: 4,
    history: [
      inbound("acc-a", 40_000, hour(3)),
      outbound("acc-x", 38_500, hour(2)),
    ],
  });

  it("flags a young pass-through company sharing a nominee", () => {
    const result = shellIntermediarySignal(
      makeTransaction({
        receiverAccountId: "acc-b",
        receiverName: "Horizon Trade FZE",
        amountBase: 38_500,
        externalId: "forward-1",
      }),
      makeContext({
        accounts: { "acc-a": makeAccount(), "acc-b": shellAccount },
      }),
    );
    expect(result.raw).toBe(1);
    expect(result.narrative).toContain("Horizon Trade FZE");
    expect(result.facts.pass_through_ratio).toBeGreaterThanOrEqual(0.9);
  });

  it("ignores individuals", () => {
    const result = shellIntermediarySignal(makeTransaction(), makeContext());
    expect(result.raw).toBe(0);
  });

  it("gives partial weight to a recently incorporated company", () => {
    const result = shellIntermediarySignal(
      makeTransaction({ receiverAccountId: "acc-b", amountBase: 2_500 }),
      makeContext({
        accounts: {
          "acc-a": makeAccount(),
          "acc-b": makeAccount({
            id: "acc-b",
            incorporatedOn: "2026-06-01",
            nomineeEntityCount: 0,
            history: [inbound("acc-a", 2_000, hour(1))],
          }),
        },
      }),
    );
    expect(result.raw).toBeCloseTo(0.35, 2);
  });
});

describe("first-time corridor signal", () => {
  it("flags a corridor the account has never used", () => {
    const result = firstTimeCorridorSignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: [outbound("x", 100, day(1), { corridor: "US-GB" })] }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0.85);
  });

  it("does not flag a familiar corridor", () => {
    const result = firstTimeCorridorSignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ history: [outbound("x", 100, day(1), { corridor: "US-DE" })] }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0);
  });

  it("flags the very first transfer for a new account", () => {
    const result = firstTimeCorridorSignal(makeTransaction(), makeContext());
    expect(result.raw).toBe(1);
  });
});

describe("currency mismatch signal", () => {
  it("flags USD settlement from an Indian domicile", () => {
    const result = currencyMismatchSignal(
      makeTransaction({ currency: "USD", senderCountry: "IN" }),
      makeContext(),
    );
    expect(result.raw).toBe(0.8);
    expect(result.narrative).toContain("IN");
  });

  it("accepts a matching currency", () => {
    const result = currencyMismatchSignal(
      makeTransaction({ currency: "USD", senderCountry: "US" }),
      makeContext(),
    );
    expect(result.raw).toBe(0);
  });

  it("accepts EUR from a German account", () => {
    const result = currencyMismatchSignal(
      makeTransaction({ currency: "EUR", senderCountry: "DE" }),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ country: "DE", currency: "EUR" }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0);
  });
});

describe("PEP exposure signal", () => {
  it("flags a politically exposed receiver at maximum", () => {
    const result = pepExposureSignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount(),
          "acc-b": makeAccount({ id: "acc-b", pepFlag: true }),
        },
      }),
    );
    expect(result.raw).toBe(1);
  });

  it("gives partial weight when only the sender is exposed", () => {
    const result = pepExposureSignal(
      makeTransaction(),
      makeContext({
        accounts: {
          "acc-a": makeAccount({ pepFlag: true }),
          "acc-b": makeAccount(),
        },
      }),
    );
    expect(result.raw).toBe(0.6);
  });

  it("returns zero when neither party is exposed", () => {
    expect(pepExposureSignal(makeTransaction(), makeContext()).raw).toBe(0);
  });
});

describe("signal configuration bounds", () => {
  it("never returns a raw value outside 0 and 1", () => {
    const result = amountThresholdSignal(
      makeTransaction({ amountBase: 1_000_000 }),
      makeContext(),
      { ...defaultRiskConfig, reportingThresholdUsd: 1 },
    );
    expect(result.raw).toBeGreaterThanOrEqual(0);
    expect(result.raw).toBeLessThanOrEqual(1);
  });
});
