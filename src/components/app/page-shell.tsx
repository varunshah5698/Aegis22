import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Page shell                                                                  */
/* -------------------------------------------------------------------------- */

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1560px] space-y-5", className)}>
      <header className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="label-xs">{eyebrow}</p> : null}
          <h1 className="mt-1.5 font-display text-[27px] font-semibold leading-9 tracking-[-0.035em]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">{description}</p>
          ) : null}
          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? <div className="toolbar shrink-0 lg:justify-end">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function PageSection({
  id,
  title,
  description,
  action,
  legend,
  footnote,
  children,
  className,
  bodyClassName,
  flush,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  legend?: React.ReactNode;
  footnote?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn("panel min-w-0", className)}>
      <div className="panel-head">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="panel-title">
            {title}
          </h2>
          {description ? <p className="panel-caption mt-1">{description}</p> : null}
          {legend ? <div className="mt-2.5">{legend}</div> : null}
        </div>
        {action ? <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      <div className={cn(!flush && "px-5 py-4", bodyClassName)}>{children}</div>
      {footnote ? (
        <div className="border-t border-border/60 px-5 py-2.5 text-[11px] leading-4 text-muted-foreground">{footnote}</div>
      ) : null}
    </section>
  );
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Small display primitives                                                    */
/* -------------------------------------------------------------------------- */

/** Inline sparkline: a line plus a soft area fill, sized by the caller. */
export function Sparkline({
  values,
  className,
  fill = true,
  strokeWidth = 1.6,
}: {
  values: number[];
  className?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 30 - ((value - min) / span) * 26 - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.join(" ");
  const area = `0,30 ${line} 100,30`;

  return (
    <svg viewBox="0 0 100 30" className={cn("h-8 w-full", className)} aria-hidden="true" preserveAspectRatio="none">
      {fill ? <polygon points={area} fill="currentColor" opacity={0.14} /> : null}
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function TrendPill({
  change,
  invert,
  neutral,
  suffix = "%",
  className,
}: {
  change: number | null | undefined;
  invert?: boolean | undefined;
  /** Renders the direction without judging it good or bad. */
  neutral?: boolean | undefined;
  suffix?: string;
  className?: string;
}) {
  if (typeof change !== "number" || !Number.isFinite(change)) {
    return <span className={cn("chip text-muted-foreground", className)}>flat</span>;
  }
  const rising = change > 0.05;
  const falling = change < -0.05;
  const good = invert ? falling : rising;
  const tone = neutral
    ? "text-muted-foreground"
    : !rising && !falling
      ? "text-muted-foreground"
      : good
        ? "text-risk-low"
        : "text-risk-high";
  const Icon = !rising && !falling ? Minus : rising ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-medium", tone, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="num">{Math.abs(change).toFixed(1)}{suffix}</span>
    </span>
  );
}

/** The standard metric tile: label, big value, trend, optional sparkline. */
export function MetricTile({
  label,
  value,
  hint,
  change,
  invert,
  neutralTrend,
  spark,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | undefined;
  change?: number | null | undefined;
  invert?: boolean | undefined;
  /** Volume metrics read as information, not good or bad news. */
  neutralTrend?: boolean | undefined;
  spark?: number[] | undefined;
  tone?: "default" | "critical" | "warning" | "positive" | "accent" | undefined;
  href?: string | undefined;
  className?: string | undefined;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="label-xs">{label}</p>
        {typeof change === "number" ? (
          <TrendPill change={change} invert={invert} neutral={neutralTrend} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2.5 metric-value",
          tone === "critical" && "text-risk-critical",
          tone === "warning" && "text-risk-medium",
          tone === "positive" && "text-risk-low",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11.5px] leading-4 text-muted-foreground">{hint}</p> : null}
      {spark && spark.length > 1 ? (
        <div
          className={cn(
            "mt-3",
            tone === "critical"
              ? "text-risk-critical/70"
              : tone === "warning"
                ? "text-risk-medium/70"
                : tone === "positive"
                  ? "text-risk-low/70"
                  : "text-accent/70",
          )}
        >
          <Sparkline values={spark} />
        </div>
      ) : null}
    </>
  );

  return (
    <div className={cn("panel min-w-0 px-4 py-3.5", className)}>
      {href ? (
        <Link href={href} className="block rounded-tile transition-opacity hover:opacity-90">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function LegendChip({ label, color, className }: { label: string; color?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span className="size-2 rounded-sm" style={{ background: color ?? "rgb(var(--accent))" }} aria-hidden="true" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Legacy strip (kept for pages that use it)                                   */
/* -------------------------------------------------------------------------- */

export function StatStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    hint?: string;
    tone?: "default" | "critical" | "warning" | "positive";
    /** Signed percentage change against the previous comparable window. */
    change?: number;
    /** Set when a rise is the bad direction for this metric. */
    invert?: boolean;
  }>;
}) {
  return (
    <dl className="panel grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-4 py-3.5">
          <dt className="label-xs">{item.label}</dt>
          <dd
            className={cn(
              "mt-2 metric-value",
              item.tone === "critical" && "text-risk-critical",
              item.tone === "warning" && "text-risk-medium",
              item.tone === "positive" && "text-risk-low",
            )}
          >
            {item.value}
          </dd>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] leading-4">
            {typeof item.change === "number" ? <TrendPill change={item.change} invert={item.invert} /> : null}
            {item.hint ? <span className="truncate text-muted-foreground">{item.hint}</span> : null}
          </div>
        </div>
      ))}
    </dl>
  );
}
