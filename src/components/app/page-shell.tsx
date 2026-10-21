import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

import { InfoTooltip } from "@/components/ui/info-tooltip";
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
    <div className={cn("workspace-stack mx-auto w-full max-w-[1560px]", className)}>
      <header className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="flex items-center gap-2 font-mono text-[11.5px] font-medium text-muted-foreground">
              <span className="h-px w-5 bg-accent/80" aria-hidden="true" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="app-title mt-2.5">
            {title}
          </h1>
          {description ? (
            <p className="app-subtitle">
              {description}
            </p>
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
      <div className={cn("panel-body", !flush && "px-5 py-4", bodyClassName)}>{children}</div>
      {footnote ? (
        <div className="border-t border-border/60 px-5 py-2.5 text-[11px] leading-4 text-muted-foreground">
          {footnote}
        </div>
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
    <svg
      viewBox="0 0 100 30"
      className={cn("h-8 w-full", className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {fill ? <polygon className="anim-fade" points={area} fill="currentColor" opacity={0.14} /> : null}
      <polyline
        className="anim-draw"
        pathLength={1}
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
    <span
      className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-medium", tone, className)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="num">
        {Math.abs(change).toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

/**
 * One row for every metric band in the workspace.
 *
 * The column count follows the number of tiles, so a four-tile page and a
 * five-tile page both fill their row instead of leaving one card orphaned on
 * a second line.
 */
export function MetricRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const count = React.Children.count(children);
  const columns =
    count >= 6
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      : count === 5
        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        : count === 4
          ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
          : count === 3
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2";

  return <div className={cn("metric-row grid gap-4", columns, className)}>{children}</div>;
}

const toneText = (tone: string) =>
  tone === "critical"
    ? "text-risk-critical"
    : tone === "warning"
      ? "text-risk-medium"
      : tone === "positive"
        ? "text-risk-low"
        : tone === "accent"
          ? "text-accent"
          : "text-foreground";

const toneIcon = (tone: string) =>
  tone === "critical"
    ? "border-risk-critical/25 bg-risk-critical/10 text-risk-critical"
    : tone === "warning"
      ? "border-risk-medium/25 bg-risk-medium/10 text-risk-medium"
      : tone === "positive"
        ? "border-risk-low/25 bg-risk-low/10 text-risk-low"
        : "border-accent/25 bg-accent/10 text-accent";

const toneSpark = (tone: string) =>
  tone === "critical"
    ? "text-risk-critical/70"
    : tone === "warning"
      ? "text-risk-medium/70"
      : tone === "positive"
        ? "text-risk-low/70"
        : "text-accent/70";

/**
 * The standard metric tile: icon, label, big value, trend and optional
 * sparkline. Every page uses this so the summary band reads as one component.
 */
export function MetricTile({
  label,
  value,
  hint,
  comparison,
  change,
  invert,
  neutralTrend,
  spark,
  tone = "default",
  href,
  icon: Icon,
  definition,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | undefined;
  /** Secondary line under the hint, e.g. "median 82 · p90 91". */
  comparison?: string | undefined;
  change?: number | null | undefined;
  invert?: boolean | undefined;
  /** Volume metrics read as information, not good or bad news. */
  neutralTrend?: boolean | undefined;
  spark?: number[] | undefined;
  tone?: "default" | "critical" | "warning" | "positive" | "accent" | undefined;
  href?: string | undefined;
  icon?: LucideIcon | undefined;
  /** Definition shown in a tooltip next to the label. */
  definition?: string | undefined;
  className?: string | undefined;
}) {
  const gradient = tone === "accent";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={cn("label-xs min-w-0 leading-4", gradient && "text-white/75")}>{label}</p>
          {definition ? (
            <InfoTooltip text={definition} className="pointer-events-auto relative z-10" />
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[9px] border",
              gradient ? "border-white/30 bg-white/20 text-white" : toneIcon(tone),
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "metric-value mt-2.5 min-w-0 truncate",
          gradient ? "text-white" : toneText(tone),
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {typeof change === "number" ? (
          <TrendPill
            change={change}
            invert={invert}
            neutral={neutralTrend}
            className={gradient ? "text-white" : ""}
          />
        ) : null}
        {hint ? (
          <span
            className={cn(
              "min-w-0 truncate text-[11.5px] leading-4",
              gradient ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {comparison ? (
        <p
          className={cn(
            "mt-0.5 truncate text-[11px] leading-4",
            gradient ? "text-white/70" : "text-muted-foreground/80",
          )}
        >
          {comparison}
        </p>
      ) : null}
      {spark && spark.length > 1 ? (
        <div className={cn("mt-auto pt-3", gradient ? "text-white/75" : toneSpark(tone))}>
          <Sparkline values={spark} className="h-8" />
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "panel flex min-h-[112px] min-w-0 flex-col px-5 py-4",
        gradient &&
          "border-0 bg-[linear-gradient(140deg,#8B7CFF_0%,#6D5CFF_45%,#5B4BE8_100%)] shadow-[0_16px_36px_-18px_rgba(109,92,255,0.55)]",
        href && "transition-colors hover:border-border-strong",
        className,
      )}
    >
      {href ? (
        <Link href={href} className="flex min-h-0 flex-1 flex-col rounded-tile">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function LegendChip({
  label,
  color,
  className,
}: {
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span
        className="size-2 rounded-sm"
        style={{ background: color ?? "rgb(var(--accent))" }}
        aria-hidden="true"
      />
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
    <MetricRow>
      {items.map((item) => (
        <MetricTile
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          change={item.change}
          invert={item.invert}
          tone={item.tone}
        />
      ))}
    </MetricRow>
  );
}
