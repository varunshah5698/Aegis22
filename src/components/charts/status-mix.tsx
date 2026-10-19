import Link from "next/link";

import { RISK_COLORS, statusColors, type RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  new: "New",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  false_positive: "False positive",
};

const severityLabels: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Alert outcomes as one proportional bar plus a readable list. Answers "what
 * happened to everything we raised" in a single glance.
 */
export function StatusMix({
  data,
  total,
  href = "/app/alerts",
  className,
}: {
  data: Array<{ status: string; count: number }>;
  total: number;
  href?: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((entry) => entry.count));
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Alert status split">
        {data.map((entry) =>
          entry.count > 0 ? (
            <span
              key={entry.status}
              style={{ width: `${(entry.count / Math.max(1, total)) * 100}%`, background: statusColors[entry.status as keyof typeof statusColors] }}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {data.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: statusColors[entry.status as keyof typeof statusColors] }}
              aria-hidden="true"
            />
            <span className="w-[104px] shrink-0 text-[12px] text-muted-foreground">
              {statusLabels[entry.status] ?? entry.status}
            </span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/70">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(entry.count / max) * 100}%`,
                  background: statusColors[entry.status as keyof typeof statusColors],
                }}
              />
            </span>
            <span className="num w-10 shrink-0 text-right text-[12.5px] font-medium">{entry.count}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">
        <Link href={href} className="font-medium text-foreground underline decoration-border decoration-1 underline-offset-2">
          Open the queue
        </Link>{" "}
        to work through unresolved alerts.
      </p>
    </div>
  );
}

/** Severity ladder: how much of the backlog is genuinely high-risk. */
export function SeverityLadder({
  data,
  className,
}: {
  data: Array<{ severity: RiskLevel; count: number }>;
  className?: string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((entry) => {
        const share = total > 0 ? (entry.count / total) * 100 : 0;
        return (
          <li key={entry.severity}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: RISK_COLORS[entry.severity] }} aria-hidden="true" />
                {severityLabels[entry.severity]}
              </span>
              <span className="num text-[12.5px] font-medium">{entry.count}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(share > 0 ? 2 : 0, share)}%`, background: RISK_COLORS[entry.severity] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** SLA health: breached, running out of time and comfortably in-window. */
export function SlaStrip({
  breached,
  dueSoon,
  open,
  className,
}: {
  breached: number;
  dueSoon: number;
  open: number;
  className?: string;
}) {
  const onTrack = Math.max(0, open - breached - dueSoon);
  const items = [
    { label: "Breached", value: breached, tone: "text-risk-critical", bar: "bg-risk-critical" },
    { label: "Due < 6h", value: dueSoon, tone: "text-risk-medium", bar: "bg-risk-medium" },
    { label: "On track", value: onTrack, tone: "text-risk-low", bar: "bg-risk-low" },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {open > 0 ? (
          <>
            <span className="bg-risk-critical" style={{ width: `${(breached / open) * 100}%` }} />
            <span className="bg-risk-medium" style={{ width: `${(dueSoon / open) * 100}%` }} />
            <span className="bg-risk-low" style={{ width: `${(onTrack / open) * 100}%` }} />
          </>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-tile border border-border/70 bg-elevated/60 px-2.5 py-2">
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{item.label}</dt>
            <dd className={cn("num mt-1 text-[17px] font-medium leading-5", item.tone)}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
