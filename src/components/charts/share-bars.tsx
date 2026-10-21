import Link from "next/link";

import { cn } from "@/lib/utils";

export interface ShareBarItem {
  key: string;
  label: string;
  href: string;
  value: number;
  display: string;
  share: number;
  detail: string;
  muted?: boolean;
}

/**
 * Ranked share bars: label, proportional track, exact percentage and a shared
 * axis. Each row is a link into the records behind it.
 */
export function ShareBars({ items, className }: { items: ShareBarItem[]; className?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">No activity in this window.</p>;
  }

  const ceiling = Math.max(10, Math.ceil(Math.max(...items.map((item) => item.share)) / 10) * 10);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("min-w-0", className)}>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              title={item.detail}
              className="group grid grid-cols-[56px_minmax(0,1fr)_42px] items-center gap-3 rounded-[4px] py-0.5"
            >
              <span className="num truncate text-[11px] font-medium text-foreground/85 group-hover:text-foreground">
                {item.label}
              </span>
              <span className="relative block h-[13px]">
                <span className="absolute inset-0 rounded-[2px] bg-muted/40" aria-hidden="true" />
                <span
                  className="absolute inset-y-0 left-0 rounded-[2px] transition-opacity group-hover:opacity-80"
                  style={{
                    width: `${Math.max(1.5, (item.share / ceiling) * 100)}%`,
                    background: item.muted
                      ? "rgb(var(--muted-foreground) / 0.55)"
                      : "linear-gradient(90deg, rgb(var(--accent) / 0.85), rgb(var(--accent)))",
                  }}
                  aria-hidden="true"
                />
              </span>
              <span className="num text-right text-[11.5px] font-medium">{item.share.toFixed(1)}%</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-[56px_minmax(0,1fr)_42px] gap-3">
        <span aria-hidden="true" />
        <div className="relative h-4 border-t border-border/60">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="num absolute top-1 -translate-x-1/2 text-[11px] text-muted-foreground/80"
              style={{ left: `${tick * 100}%` }}
            >
              {Math.round(ceiling * tick)}%
            </span>
          ))}
        </div>
        <span aria-hidden="true" />
      </div>

      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
        Share of screened value in the window. Select a corridor to open its payments.
      </p>
    </div>
  );
}
