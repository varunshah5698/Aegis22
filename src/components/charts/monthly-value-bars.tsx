import type { MonthlyTotal } from "@/lib/data/overview";
import { formatCompactNumber } from "@/lib/utils";

/**
 * Grouped bar chart for the overview bento: screened value in coral, flagged
 * value in near-black — the reference's Profit & Loss treatment. Drawn with
 * plain divs; eight months of two bars do not need a chart library.
 *
 * The month labels live in their own row *below* the plotting area rather than
 * inside each column, so a label never eats into the height the bars are
 * measured against.
 *
 * The plot is linear and every month is drawn at its true share of the peak.
 * Months with no volume render flat, which is the honest picture: a workspace
 * whose payments only span a few weeks really does have an empty back half of
 * the year, and a non-linear scale would dress that up as activity that isn't
 * there.
 */
export function MonthlyValueBars({ data, height = 200 }: { data: MonthlyTotal[]; height?: number }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="flex gap-2">
      {/* Y-axis value labels, aligned to the gridlines. */}
      <div className="flex w-10 shrink-0 flex-col justify-between text-right text-[10px] leading-3 text-muted-foreground" style={{ height }}>
        {ticks.map((share) => (
          <span key={share} className="num">
            {share === 0 ? "0" : `$${formatCompactNumber(Math.round(max * share))}`}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {/* Plotting area: gridlines behind, bars in front, month labels below. */}
        <div className="relative" style={{ height }}>
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((share) => (
              <div key={share} className="h-px w-full bg-border/60" />
            ))}
          </div>

          <div className="relative flex h-full items-end justify-between gap-1">
            {data.map((point) => (
              <div
                key={point.label}
                className="group flex h-full min-w-0 flex-1 items-end justify-center gap-[3px]"
                title={`${point.label}: screened $${formatCompactNumber(point.value)} · flagged $${formatCompactNumber(point.flaggedValue)}`}
              >
                <div
                  className="w-[10px] rounded-t-[4px] bg-[rgb(var(--chart-1))] transition-opacity group-hover:opacity-80 sm:w-[13px]"
                  style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
                <div
                  className="w-[10px] rounded-t-[4px] bg-[rgb(var(--chart-2))] transition-opacity group-hover:opacity-80 sm:w-[13px]"
                  style={{ height: `${Math.max(1.5, (point.flaggedValue / max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Month labels in their own row, one column per month. */}
        <div className="mt-2 flex justify-between gap-1">
          {data.map((point) => (
            <span key={point.label} className="min-w-0 flex-1 truncate text-center text-[10.5px] leading-4 text-muted-foreground">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
