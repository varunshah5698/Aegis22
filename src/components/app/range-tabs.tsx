import Link from "next/link";

import { rangeOptions } from "@/lib/data/common";
import { cn } from "@/lib/utils";

export function RangeTabs({
  basePath,
  current,
  extra,
}: {
  basePath: string;
  current: string;
  extra?: Record<string, string>;
}) {
  const query = (value: string) => {
    const params = new URLSearchParams(extra);
    params.set("range", value);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center rounded-panel border border-border bg-card p-0.5" role="group" aria-label="Time range">
      {rangeOptions.map((option) => (
        <Link
          key={option.value}
          href={query(option.value)}
          aria-current={option.value === current ? "page" : undefined}
          className={cn(
            "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
            option.value === current
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
