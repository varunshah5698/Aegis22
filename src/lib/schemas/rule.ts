import { z } from "zod";

import { riskLevels } from "@/config/risk";

export const ruleFields = [
  "amount",
  "amount_base",
  "corridor",
  "sender_country",
  "receiver_country",
  "channel",
  "velocity_24h",
  "new_counterparty",
  "account_age_days",
  "time_window_sum",
] as const;
export type RuleField = (typeof ruleFields)[number];

export const ruleFieldMeta: Record<
  RuleField,
  { label: string; valueType: "number" | "text" | "boolean" | "list" | "range"; hint: string }
> = {
  amount: { label: "Amount", valueType: "number", hint: "Transaction amount in its own currency" },
  amount_base: { label: "Amount (base)", valueType: "number", hint: "Amount converted to USD" },
  corridor: { label: "Corridor", valueType: "text", hint: "Sender-receiver country pair, e.g. US-DE" },
  sender_country: { label: "Sender country", valueType: "text", hint: "ISO 3166-1 alpha-2" },
  receiver_country: { label: "Receiver country", valueType: "text", hint: "ISO 3166-1 alpha-2" },
  channel: { label: "Channel", valueType: "list", hint: "SWIFT, WIRE, SEPA, ACH, LOCAL, CARD" },
  velocity_24h: { label: "Velocity (24h)", valueType: "number", hint: "Value sent in the last 24 hours" },
  new_counterparty: { label: "New counterparty", valueType: "boolean", hint: "Receiver unseen for 180 days" },
  account_age_days: { label: "Account age (days)", valueType: "number", hint: "Days since the account opened" },
  time_window_sum: {
    label: "Sum in window",
    valueType: "range",
    hint: "Sum of related transfers inside a rolling window, honored as [hours, amount]",
  },
};

export const ruleOperators = [
  "equals",
  "not_equals",
  "in",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "between",
  "within_last_hours",
] as const;
export type RuleOperator = (typeof ruleOperators)[number];

export const operatorLabels: Record<RuleOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  in: "is one of",
  greater_than: "is greater than",
  greater_or_equal: "is greater than or equal to",
  less_than: "is less than",
  less_or_equal: "is less than or equal to",
  between: "is between",
  within_last_hours: "occurred within the last (hours)",
};

export const operatorsForField = (field: RuleField): RuleOperator[] => {
  switch (ruleFieldMeta[field].valueType) {
    case "number":
      return ["greater_than", "greater_or_equal", "less_than", "less_or_equal", "equals", "between"];
    case "boolean":
      return ["equals"];
    case "list":
      return ["in", "not_equals"];
    case "range":
      return ["within_last_hours"];
    case "text":
    default:
      return ["equals", "not_equals", "in"];
  }
};

const conditionValue = z.union([
  z.string().max(64),
  z.number(),
  z.boolean(),
  z.array(z.string().max(64)).max(50),
  z.tuple([z.number(), z.number()]),
]);

export const conditionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("condition"),
  field: z.enum(ruleFields),
  operator: z.enum(ruleOperators),
  value: conditionValue,
});

export type RuleCondition = z.infer<typeof conditionSchema>;

export type RuleGroup = {
  id: string;
  kind: "group";
  logic: "and" | "or";
  children: Array<RuleCondition | RuleGroup>;
};

export const groupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    kind: z.literal("group"),
    logic: z.enum(["and", "or"]),
    children: z.array(z.union([conditionSchema, groupSchema])).min(1).max(12),
  }),
);

export const ruleActionsSchema = z.object({
  createAlert: z.boolean(),
  severity: z.enum(riskLevels),
  scorePoints: z.number().int().min(0).max(100),
  tags: z.array(z.string().min(1).max(32)).max(8),
});

export const ruleDefinitionSchema = z.object({
  version: z.literal(1),
  root: groupSchema,
  actions: ruleActionsSchema,
});

export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type RuleActions = z.infer<typeof ruleActionsSchema>;

export const ruleMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Give the rule a name of at least 3 characters")
    .max(120, "Keep the name under 120 characters"),
  description: z.string().trim().max(600, "Keep the description under 600 characters").default(""),
  changeNote: z.string().trim().max(300).default(""),
});

export const createRuleSchema = z.object({
  name: ruleMetadataSchema.shape.name,
  description: ruleMetadataSchema.shape.description,
});

export const updateRuleDraftSchema = z.object({
  ruleId: z.string().uuid(),
  definition: ruleDefinitionSchema,
  changeNote: z.string().trim().max(300).optional(),
});

export const publishRuleSchema = z.object({
  ruleId: z.string().uuid(),
  changeNote: z.string().trim().max(300).default(""),
});

export const simulateRuleSchema = z.object({
  ruleId: z.string().uuid(),
  definition: ruleDefinitionSchema,
  days: z.number().int().min(1).max(90).default(30),
});

const MAX_DEPTH = 3;

export function definitionDepth(group: RuleGroup, depth = 1): number {
  const childDepths = group.children.map((child) =>
    child.kind === "group" ? definitionDepth(child, depth + 1) : depth,
  );
  return Math.max(depth, ...childDepths);
}

export function validateDefinitionDepth(definition: RuleDefinition): string | null {
  const depth = definitionDepth(definition.root);
  if (depth > MAX_DEPTH) {
    return `Condition groups can be nested at most ${MAX_DEPTH} levels deep. This rule is ${depth} levels deep.`;
  }
  return null;
}

export function definitionHash(definition: RuleDefinition): string {
  const serialized = JSON.stringify(definition);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index++) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function describeCondition(condition: RuleCondition): string {
  const meta = ruleFieldMeta[condition.field];
  const operator = operatorLabels[condition.operator];
  const value = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : typeof condition.value === "boolean"
      ? condition.value
        ? "yes"
        : "no"
      : String(condition.value);
  return `${meta.label} ${operator} ${value}`;
}

export function describeRule(definition: RuleDefinition): string {
  const walk = (group: RuleGroup): string => {
    const parts = group.children.map((child) =>
      child.kind === "group" ? `(${walk(child)})` : describeCondition(child),
    );
    return parts.join(group.logic === "and" ? " AND " : " OR ");
  };
  return `Flag a payment when ${walk(definition.root)}.`;
}
