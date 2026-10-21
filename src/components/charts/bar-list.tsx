import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Formatted value shown at the end of the row. */
  display?: React.ReactNode;
  /** Secondary figure shown before the value, for example a share. */
  secondary?: React.ReactNode;
  /** Bar colour, defaults to the accent token. */
  color?: string;
  hint?: string;
}

/**
 * Generic ranking list: a label, a proportional bar and the exact figure. Used
 * wherever a chart would add noise but the relative size still matters.
 */
export function BarList({
  items,
  max,
  className,
  barClassName,
  emptyMessage = "Nothing to show for this window.",
}: {
  items: BarListItem[];
  max?: number;
  className?: string;
  barClassName?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">{emptyMessage}</p>;
  }
  const ceiling = Math.max(1, max ?? Math.max(...items.map((item) => item.value)));

  return (
    <Reveal className={className}>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={item.key} className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <span
                className="min-w-0 flex-1 truncate text-[12px] leading-4 text-foreground/90"
                title={item.hint ?? undefined}
              >
                {item.label}
              </span>
              {item.secondary ? (
                <span className="num shrink-0 text-[11px] text-muted-foreground">{item.secondary}</span>
              ) : null}
              {item.display ? <span className="num shrink-0 text-[12px] font-medium">{item.display}</span> : null}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                className={cn("anim-grow-x h-full rounded-full", barClassName)}
                style={{
                  width: `${Math.max(2, (item.value / ceiling) * 100)}%`,
                  background: item.color ?? "rgb(var(--accent))",
                  "--d": 60 + index * 70,
                } as React.CSSProperties}
              />
            </div>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
