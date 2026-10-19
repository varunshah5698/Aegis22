export const REPORT_KINDS = ["sar_summary", "daily_digest", "audit_log"] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  sar_summary: "SAR supporting summary",
  daily_digest: "Daily monitoring digest",
  audit_log: "Audit log export",
};

export const REPORT_KIND_DESCRIPTIONS: Record<ReportKind, string> = {
  sar_summary: "Every alert and its transaction detail, ready to attach to a suspicious activity report.",
  daily_digest: "Day-by-day volume, high-risk counts, blocked payments and alert throughput.",
  audit_log: "Who did what inside the workspace, with targets and metadata.",
};
