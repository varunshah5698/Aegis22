"use client";

import * as React from "react";

import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TimeAgo({
  value,
  className,
  title,
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const [label, setLabel] = React.useState<string>("");
  React.useEffect(() => {
    setLabel(relativeTime(value));
    const timer = window.setInterval(() => setLabel(relativeTime(value)), 60_000);
    return () => window.clearInterval(timer);
  }, [value]);
  return (
    <time dateTime={value} title={title} className={cn("text-muted-foreground", className)}>
      {label || "—"}
    </time>
  );
}
