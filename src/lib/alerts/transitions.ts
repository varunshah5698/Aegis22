import type { AlertStatus } from "@/lib/alerts/types";

/** Workflow is enforced server-side; the UI only offers valid next steps. */
export const ALERT_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  new: ["investigating"],
  investigating: ["escalated", "resolved", "false_positive"],
  escalated: ["resolved", "investigating"],
  resolved: [],
  false_positive: [],
};

export function canTransition(from: AlertStatus, to: AlertStatus): boolean {
  return ALERT_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: AlertStatus): AlertStatus[] {
  return ALERT_TRANSITIONS[from];
}

export const STATUS_LABELS: Record<AlertStatus, string> = {
  new: "New",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  false_positive: "False positive",
};

export type SlaState = "ok" | "warning" | "breached" | "none";

export function slaState(dueAt: string | null, now = Date.now()): SlaState {
  if (!dueAt) return "none";
  const remaining = new Date(dueAt).getTime() - now;
  if (remaining <= 0) return "breached";
  return remaining < 2 * 3_600_000 ? "warning" : "ok";
}

export function slaLabel(dueAt: string | null, now = Date.now()): string {
  if (!dueAt) return "No SLA";
  const remaining = new Date(dueAt).getTime() - now;
  const absolute = Math.abs(remaining);
  const hours = Math.floor(absolute / 3_600_000);
  const minutes = Math.floor((absolute % 3_600_000) / 60_000);
  const amount = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return remaining <= 0 ? `Breached ${amount} ago` : `${amount} left`;
}
