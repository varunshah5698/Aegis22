import type { RiskLevel } from "@/config/risk";

export const ALERT_STATUSES = ["new", "investigating", "escalated", "resolved", "false_positive"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const SAVED_VIEWS = [
  { id: "all", label: "All open", statuses: ["new", "investigating", "escalated"] as AlertStatus[] },
  { id: "mine", label: "My open", statuses: ["new", "investigating", "escalated"] as AlertStatus[] },
  { id: "critical", label: "Critical", statuses: ["new", "investigating", "escalated"] as AlertStatus[] },
  { id: "breaching", label: "SLA breaching", statuses: ["new", "investigating", "escalated"] as AlertStatus[] },
  { id: "unassigned", label: "Unassigned", statuses: ["new", "investigating", "escalated"] as AlertStatus[] },
] as const;

export type SavedViewId = (typeof SAVED_VIEWS)[number]["id"];

export interface AlertQueueRow {
  id: string;
  title: string;
  severity: RiskLevel;
  status: AlertStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
  transactionId: string;
  externalId: string;
  amount: number;
  currency: string;
  amountBase: number;
  corridor: string;
}
