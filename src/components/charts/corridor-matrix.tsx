import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { cn, formatCompactNumber } from "@/lib/utils";

export interface CorridorCell {
  corridor: string;
  senderCountry: string;
  receiverCountry: string;
  count: number;
  value: number;
  flagged: number;
  averageScore: number;
}

function scoreTone(score: number): string {
  if (score >= 85) return "bg-risk-critical/90 text-white";
  if (score >= 70) return "bg-risk-high/85 text-white";
  if (score >= 40) return "bg-risk-medium/85 text-[#3a2600]";
  if (score > 0) return "bg-risk-low/70 text-[#04231c]";
  return "bg-muted text-muted-foreground";
}

/**
 * Sender × receiver heat matrix. Each cell links straight to the filtered
 * transaction list, so the map doubles as a navigation surface.
 */
export function CorridorMatrix({
  corridors,
  legend = true,
  className,
}: {
  corridors: CorridorCell[];
  legend?: boolean;
  className?: string;
}) {
  const senders = [...new Set(corridors.map((corridor) => corridor.senderCountry))].slice(0, 14);
  const receivers = [...new Set(corridors.map((corridor) => corridor.receiverCountry))].slice(0, 14);
  const byPair = new Map(corridors.map((corridor) => [corridor.corridor, corridor]));

  if (senders.length === 0) {
    return <p className="py-8 text-center text-[12px] text-muted-foreground">No corridors in this window.</p>;
  }

  return (
    <Reveal className={className}>
      <div className="min-w-0">
      {legend ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {[
            { label: "0–39 low", className: "bg-risk-low/70" },
            { label: "40–69 medium", className: "bg-risk-medium/85" },
            { label: "70–84 high", className: "bg-risk-high/85" },
            { label: "85+ critical", className: "bg-risk-critical/90" },
          ].map((band) => (
            <span key={band.label} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", band.className)} aria-hidden="true" />
              {band.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[720px] border-separate border-spacing-[3px] text-[11px]"
          role="grid"
          aria-label="Corridor risk matrix"
        >
          <caption className="sr-only">
            Sender countries as rows and receiver countries as columns. Each cell shows the average risk score and links
            to the matching payments.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-card px-2 py-1 text-left text-[11.5px] font-medium text-muted-foreground">
                From \ To
              </th>
              {receivers.map((receiver) => (
                <th key={receiver} scope="col" className="num px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {receiver}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {senders.map((sender, rowIndex) => (
              <tr key={sender}>
                <th scope="row" className="num sticky left-0 bg-card px-2 py-1 text-left text-[11px] font-medium text-muted-foreground">
                  {sender}
                </th>
                {receivers.map((receiver, colIndex) => {
                  const cell = byPair.get(`${sender}-${receiver}`);
                  if (!cell) {
                    return (
                      <td key={receiver} className="rounded-[7px] bg-muted/25 p-1 text-center text-muted-foreground/40">
                        ·
                      </td>
                    );
                  }
                  return (
                    <td key={receiver} className="p-0">
                      <Link
                        href={`/app/transactions?corridor=${sender}-${receiver}`}
                        className={cn(
                          "anim-cell flex h-11 w-full flex-col items-center justify-center rounded-[7px] text-[11px] font-medium transition-transform hover:scale-[1.04]",
                          scoreTone(cell.averageScore),
                        )}
                        style={{ "--d": rowIndex * 34 + colIndex * 14 } as React.CSSProperties}
                        aria-label={`${sender} to ${receiver}: average score ${cell.averageScore}, ${cell.count} payments, ${cell.flagged} flagged`}
                      >
                        <span className="num text-[12.5px] leading-4">{cell.averageScore}</span>
                        <span className="num text-[11px] leading-4 opacity-80">{formatCompactNumber(cell.value)}</span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </Reveal>
  );
}
