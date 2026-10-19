import type { RuleDefinition } from "@/lib/schemas/rule";

export interface SeedRule {
  name: string;
  description: string;
  status: "active" | "draft";
  definition: RuleDefinition;
  changeNote: string;
}

export const seedRules: SeedRule[] = [
  {
    name: "Structuring watchlist",
    description:
      "Catches payments that sit just below the USD 10,000 reference threshold and rolling sums that cross it inside 24 hours.",
    status: "active",
    changeNote: "Initial calibration against 90 days of historical volume.",
    definition: {
      version: 1,
      root: {
        id: "root",
        kind: "group",
        logic: "or",
        children: [
          {
            id: "near-threshold",
            kind: "group",
            logic: "and",
            children: [
              { id: "c1", kind: "condition", field: "amount_base", operator: "greater_than", value: 9_000 },
              { id: "c2", kind: "condition", field: "amount_base", operator: "less_than", value: 10_000 },
            ],
          },
          {
            id: "window-sum",
            kind: "condition",
            field: "time_window_sum",
            operator: "within_last_hours",
            value: [24, 45_000],
          },
        ],
      },
      actions: { createAlert: true, severity: "high", scorePoints: 12, tags: ["structuring"] },
    },
  },
  {
    name: "Sanctioned corridor review",
    description:
      "Escalates any transfer touching a jurisdiction on the high-risk list for manual review before settlement.",
    status: "active",
    changeNote: "Corridor list reviewed with the compliance team.",
    definition: {
      version: 1,
      root: {
        id: "root",
        kind: "group",
        logic: "and",
        children: [
          { id: "c1", kind: "condition", field: "receiver_country", operator: "in", value: ["IR", "KP", "MM", "RU", "SY", "YE"] },
          { id: "c2", kind: "condition", field: "amount_base", operator: "greater_than", value: 5_000 },
        ],
      },
      actions: { createAlert: true, severity: "critical", scorePoints: 15, tags: ["sanctions", "corridor"] },
    },
  },
  {
    name: "Intermediary pass-through monitor",
    description:
      "Flags rapid onward transfers and first-time counterparties that resemble pass-through activity.",
    status: "active",
    changeNote: "Tuned after reviewing 40 shell company cases.",
    definition: {
      version: 1,
      root: {
        id: "root",
        kind: "group",
        logic: "or",
        children: [
          { id: "c1", kind: "condition", field: "velocity_24h", operator: "greater_than", value: 90_000 },
          { id: "c2", kind: "condition", field: "new_counterparty", operator: "equals", value: true },
        ],
      },
      actions: { createAlert: true, severity: "medium", scorePoints: 8, tags: ["intermediary"] },
    },
  },
  {
    name: "New account high value",
    description: "Draft: review large transfers from accounts opened in the last 90 days.",
    status: "draft",
    changeNote: "Awaiting backtest results before publishing.",
    definition: {
      version: 1,
      root: {
        id: "root",
        kind: "group",
        logic: "and",
        children: [
          { id: "c1", kind: "condition", field: "account_age_days", operator: "less_than", value: 90 },
          { id: "c2", kind: "condition", field: "amount_base", operator: "greater_than", value: 25_000 },
        ],
      },
      actions: { createAlert: true, severity: "high", scorePoints: 10, tags: ["new-account"] },
    },
  },
  {
    name: "Channel concentration",
    description: "Draft: watch unusual concentration of LOCAL channel traffic on a single corridor.",
    status: "draft",
    changeNote: "Needs a narrower field list before publishing.",
    definition: {
      version: 1,
      root: {
        id: "root",
        kind: "group",
        logic: "and",
        children: [
          { id: "c1", kind: "condition", field: "channel", operator: "in", value: ["LOCAL", "CARD"] },
          { id: "c2", kind: "condition", field: "velocity_24h", operator: "greater_than", value: 40_000 },
        ],
      },
      actions: { createAlert: true, severity: "medium", scorePoints: 6, tags: ["channel"] },
    },
  },
];
