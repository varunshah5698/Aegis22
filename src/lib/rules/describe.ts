import {
  operatorLabels,
  ruleFieldMeta,
  type RuleCondition,
  type RuleGroup,
} from "@/lib/schemas/rule";

function formatValue(value: RuleCondition["value"], field: RuleCondition["field"]): string {
  const meta = ruleFieldMeta[field];
  if (Array.isArray(value)) {
    if (field === "time_window_sum" && value.length === 2) {
      return `USD ${Number(value[1]).toLocaleString("en-US")} inside ${Number(value[0])}h`;
    }
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "number" || (meta?.valueType === "number" && !Number.isNaN(Number(value)))) {
    return Number(value).toLocaleString("en-US");
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export function describeCondition(condition: RuleCondition): string {
  const meta = ruleFieldMeta[condition.field];
  const label = meta?.label ?? condition.field;
  if (condition.field === "time_window_sum") {
    return `${label} reaches ${formatValue(condition.value, condition.field)}`;
  }
  return `${label} ${operatorLabels[condition.operator] ?? condition.operator} ${formatValue(condition.value, condition.field)}`;
}

export interface DescribedGroup {
  logic: "and" | "or";
  items: Array<{ kind: "condition"; text: string } | { kind: "group"; group: DescribedGroup }>;
}

export function describeGroup(group: RuleGroup): DescribedGroup {
  return {
    logic: group.logic,
    items: group.children.map((child) =>
      child.kind === "group"
        ? { kind: "group" as const, group: describeGroup(child) }
        : { kind: "condition" as const, text: describeCondition(child) },
    ),
  };
}

export function countConditions(group: RuleGroup): number {
  return group.children.reduce(
    (total, child) => total + (child.kind === "group" ? countConditions(child) : 1),
    0,
  );
}
