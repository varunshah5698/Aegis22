import type { LucideIcon } from "lucide-react";

import { MetricTile } from "@/components/app/page-shell";

/**
 * Executive metric card.
 *
 * Kept as a named adapter because several pages speak in terms of "KPI card",
 * but it renders the shared MetricTile so every summary band across the
 * workspace has the same height, type scale and padding.
 */
export function KpiCard({
  label,
  value,
  icon,
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
  return (
    <MetricTile
      label={label}
      value={value}
      icon={icon}
      change={change}
      invert={invert}
      neutralTrend={neutral}
      spark={spark}
      hint={hint}
      comparison={comparison}
      definition={definition}
      href={href}
      tone={tone}
      className={className}
    />
  );
}
