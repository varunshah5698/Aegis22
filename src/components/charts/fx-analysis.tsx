import Link from "next/link";

import type { ExposureSensitivity, FxCorrelationMatrix, RangePosition } from "@/lib/fx/analytics";
import { cn, formatCompactNumber } from "@/lib/utils";

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 10) return value.toFixed(3);
  return value.toFixed(4);
}

export interface FxVolatilityRow {
  code: string;
  annualizedVolPercent: number | null;
  change30d: number | null;
  change90d: number | null;
  range: RangePosition | null;
  drawdown90d: number | null;
}

/**
 * Volatility league table with the latest fixing's position inside its 90-day
 * range. Volatility is measured, not assigned a band, and every row links to
 * the same pair in the history chart above.
 */
export function FxVolatilityTable({ rows }: { rows: FxVolatilityRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-[12px] text-muted-foreground">No pair has enough fixings to measure.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[460px]">
        <caption className="sr-only">Annualised volatility and 90-day range position by pair</caption>
        <thead>
          <tr>
            <th scope="col" className="pl-5">Pair</th>
            <th scope="col" className="text-right">Vol (ann.)</th>
            <th scope="col" className="text-right">30d</th>
            <th scope="col" className="text-right">90d</th>
            <th scope="col" className="w-[150px] pr-5">90d range position</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <th scope="row" className="num pl-5 text-left font-normal">
                <Link href={`/app/fx?pair=${row.code}`} className="hover:underline">
                  USD/{row.code}
                </Link>
              </th>
              <td className="num text-right">
                {row.annualizedVolPercent === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${row.annualizedVolPercent.toFixed(1)}%`
                )}
              </td>
              <td
                className={cn(
                  "num text-right",
                  row.change30d === null
                    ? "text-muted-foreground"
                    : row.change30d > 0
                      ? "text-risk-low"
                      : "text-risk-high",
                )}
              >
                {row.change30d === null ? "—" : `${row.change30d > 0 ? "+" : ""}${row.change30d.toFixed(2)}%`}
              </td>
              <td
                className={cn(
                  "num text-right",
                  row.change90d === null
                    ? "text-muted-foreground"
                    : row.change90d > 0
                      ? "text-risk-low"
                      : "text-risk-high",
                )}
              >
                {row.change90d === null ? "—" : `${row.change90d > 0 ? "+" : ""}${row.change90d.toFixed(2)}%`}
              </td>
              <td className="pr-5">
                {row.range === null ? (
                  <span className="text-[11px] text-muted-foreground">Not enough fixings</span>
                ) : (
                  <div>
                    <div className="relative h-1.5 w-full rounded-full bg-muted/80">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-accent/25"
                        style={{ width: `${row.range.position * 100}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-card"
                        style={{ left: `${row.range.position * 100}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="num mt-1 flex justify-between text-[9.5px] text-muted-foreground">
                      <span>{formatRate(row.range.low)}</span>
                      <span>{formatRate(row.range.high)}</span>
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border/60 px-5 py-2.5 text-[10.5px] leading-4 text-muted-foreground">
        Volatility is the annualised standard deviation of daily log returns over the 90-day window. Range position
        places the latest fixing between the window&apos;s low and high; it is a description of where the rate sits, not
        a forecast.
      </p>
    </div>
  );
}

function correlationColor(value: number): string {
  const magnitude = Math.min(1, Math.abs(value));
  const alpha = (0.1 + magnitude * 0.68).toFixed(3);
  return value >= 0 ? `rgb(var(--chart-1) / ${alpha})` : `rgb(var(--risk-high) / ${alpha})`;
}

/**
 * Pairwise correlation of daily returns. Reading a heatmap beats overlaying
 * twelve lines, and cells with too little overlap stay blank instead of
 * showing a spurious coefficient.
 */
export function FxCorrelationGrid({ matrix }: { matrix: FxCorrelationMatrix }) {
  if (matrix.codes.length < 2) {
    return (
      <p className="py-8 text-center text-[12px] text-muted-foreground">
        At least two pairs with overlapping fixings are needed for correlation.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[520px]"
        style={{ display: "grid", gridTemplateColumns: `56px repeat(${matrix.codes.length}, minmax(0, 1fr))` }}
      >
        <span aria-hidden="true" />
        {matrix.codes.map((code) => (
          <span key={`head-${code}`} className="num pb-1.5 text-center text-[10px] text-muted-foreground">
            {code}
          </span>
        ))}

        {matrix.codes.map((rowCode, rowIndex) => (
          <div key={`row-${rowCode}`} className="contents">
            <span className="num flex h-7 items-center pr-2 text-[10.5px] text-muted-foreground">{rowCode}</span>
            {matrix.values[rowIndex]!.map((value, columnIndex) => {
              const isDiagonal = rowIndex === columnIndex;
              return (
                <span
                  key={`${rowCode}-${matrix.codes[columnIndex]}`}
                  className={cn(
                    "num mx-[2px] mb-[2px] flex h-7 items-center justify-center rounded-[5px] text-[10.5px]",
                    isDiagonal ? "bg-muted/50 text-muted-foreground" : value === null ? "bg-muted/30 text-muted-foreground/50" : "text-foreground/90",
                  )}
                  style={!isDiagonal && value !== null ? { background: correlationColor(value) } : undefined}
                  title={
                    isDiagonal
                      ? `${rowCode} · 1.000`
                      : value === null
                        ? `${rowCode} / ${matrix.codes[columnIndex]} · not enough overlapping fixings`
                        : `${rowCode} / ${matrix.codes[columnIndex]} · r = ${value.toFixed(3)}`
                  }
                >
                  {isDiagonal ? "1.00" : value === null ? "—" : value.toFixed(2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[10.5px] text-muted-foreground">
        <span>Pearson correlation of daily log returns, overlapping fixings only.</span>
        <span className="flex items-center gap-1.5">
          -1
          <span className="flex h-2 w-28 overflow-hidden rounded-full" aria-hidden="true">
            {[-1, -0.5, 0, 0.5, 1].map((value) => (
              <span key={value} className="h-full flex-1" style={{ background: correlationColor(value) }} />
            ))}
          </span>
          1
        </span>
      </div>
    </div>
  );
}

/**
 * Currency translation sensitivity: screened USD value per currency times that
 * currency's one-day parametric move. The total assumes independent moves and
 * is labelled accordingly, so it cannot be mistaken for portfolio VaR.
 */
export function FxExposureSensitivityPanel({ sensitivity }: { sensitivity: ExposureSensitivity }) {
  const maxImpact = Math.max(1, ...sensitivity.rows.map((row) => row.impact ?? 0));

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2 pb-1.5 text-[11px] text-muted-foreground">
        <span>Currency · screened value</span>
        <span className="text-right">Vol (ann.)</span>
        <span className="text-right">1d impact</span>
      </div>
      <ul className="space-y-2.5">
        {sensitivity.rows.map((row) => (
          <li key={row.currency}>
            <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-baseline gap-2">
              <span className="min-w-0 truncate text-[12px]">
                <span className="num font-medium">{row.currency}</span>
                <span className="num ml-2 text-[10.5px] text-muted-foreground">
                  {formatCompactNumber(row.value)} USD
                </span>
                {row.unpriced ? (
                  <span className="ml-1.5 rounded-[5px] bg-risk-medium/15 px-1.5 py-0.5 text-[9.5px] text-risk-medium">
                    no fixing
                  </span>
                ) : null}
              </span>
              <span className="num text-right text-[11px] text-muted-foreground">
                {row.annualizedVolPercent === null ? "—" : row.annualizedVolPercent === 0 ? "base" : `${row.annualizedVolPercent.toFixed(1)}%`}
              </span>
              <span className={cn("num text-right text-[11.5px]", row.impact === null ? "text-muted-foreground" : "text-foreground")}>
                {row.impact === null ? "—" : row.impact === 0 ? "0" : `$${formatCompactNumber(row.impact)}`}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn("h-full rounded-full", row.unpriced ? "bg-risk-medium/60" : "bg-accent/70")}
                style={{ width: `${row.impact === null ? 0 : Math.max(2, (row.impact / maxImpact) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-[11px] text-muted-foreground">
          Indicative {Math.round(sensitivity.confidence * 100)}% one-day impact on the priced book
        </span>
        <span className="num text-[15px] font-medium">
          ${formatCompactNumber(sensitivity.totalImpact)}
        </span>
      </div>
      <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">
        Parametric estimate: the currency&apos;s 90-day annualised volatility ÷ √252 × 1.645, applied to the screened USD
        value and summed as if currencies moved independently. It sizes translation exposure only and is not a
        portfolio VaR, a forecast or advice.
        {sensitivity.unpricedValue > 0
          ? ` ${formatCompactNumber(sensitivity.unpricedValue)} USD sits in currencies without a published fixing and is excluded.`
          : ""}
      </p>
    </div>
  );
}
