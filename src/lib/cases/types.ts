export const CASE_STATUSES = ["open", "in_review", "closed"] as const;
export const CASE_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  in_review: "In review",
  closed: "Closed",
};

export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export interface CaseRow {
  id: string;
  title: string;
  summary: string;
  status: CaseStatus;
  priority: CasePriority;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
  alertCount: number;
  noteCount: number;
}
