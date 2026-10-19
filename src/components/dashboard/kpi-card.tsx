import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Sparkline, TrendPill } from "@/components/app/page-shell";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact executive metric: icon, label, one figure and one comparison, with
 * the trend parked on the right. The tooltip carries the definition and how the
 * figure is computed so the card never asks the reader to guess.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  change,
  invert,
  neutral,
  spark,
  hint,
  definition,
  comparison,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  change?: number | null;
  invert?: boolean;
  neutral?: boolean;
  spark?: number[];
  hint?: string;
  definition: string;
  comparison?: string;
  href?: string;
  tone?: "default" | "accent" | "warning" | "critical" | "positive";
  className?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "text-risk-medium"
      : tone === "critical"
        ? "text-risk-critical"
        : tone === "positive"
          ? "text-risk-low"
          : tone === "accent"
            ? "text-accent"
            : "text-foreground";

  const iconClass =
    tone === "warning"
      ? "border-risk-medium/25 bg-risk-medium/10 text-risk-medium"
      : tone === "critical"
        ? "border-risk-critical/25 bg-risk-critical/10 text-risk-critical"
        : tone === "positive"
          ? "border-risk-low/25 bg-risk-low/10 text-risk-low"
          : "border-accent/25 bg-accent/10 text-accent";

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-[7px] border", iconClass)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] leading-4 text-muted-foreground">{label}</p>
        <InfoTooltip text={definition} className="relative z-10 pointer-events-auto" />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
        <div className="min-w-0">
          <p className={cn("num text-[23px] font-medium leading-7 tracking-[-0.025em]", toneClass)}>{value}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] leading-4">
            {typeof change === "number" ? (
              <>
                <TrendPill change={change} invert={invert} neutral={neutral} />
                <span className="truncate text-muted-foreground">{comparison ?? "vs prior"}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{comparison ?? hint}</span>
            )}
          </div>
          {hint && typeof change === "number" ? (
            <p className="mt-0.5 truncate text-[10.5px] leading-4 text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>
        {spark && spark.length > 1 ? (
          <span
            className={cn(
              "shrink-0 pb-1",
              tone === "warning"
                ? "text-risk-medium"
                : tone === "critical"
                  ? "text-risk-critical"
                  : tone === "positive"
                    ? "text-risk-low"
                    : "text-accent",
            )}
          >
            <Sparkline values={spark} className="h-10 w-[86px]" fill={false} strokeWidth={1.5} />
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "panel group relative flex min-h-[108px] min-w-0 flex-col px-4 pb-3 pt-3.5 transition-colors",
        href && "hover:border-border-strong",
        className,
      )}
    >
      {/*
       * The whole card is a hit target, but the link is an overlay rather than a
       * wrapper so the definition tooltip stays a separate, valid control.
       */}
      {href ? (
        <Link
          href={href}
          aria-label={`Open ${label}`}
          className="absolute inset-0 z-0 rounded-panel focus-visible:outline-offset-4"
        />
      ) : null}
      <div className={cn("flex min-h-0 flex-1 flex-col", href && "pointer-events-none")}>{body}</div>
    </div>
  );
}
