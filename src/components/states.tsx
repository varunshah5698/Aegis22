"use client";

import * as React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-hero border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden="true" />}
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "This view could not load",
  description = "The request failed before it reached the database. Retry, or contact support if it keeps happening.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-hero border border-risk-critical/30 bg-risk-critical/5 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertCircle className="size-6 text-risk-critical" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden="true" /> Retry
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" asChild>
          <a href={`mailto:support@aegis.example?subject=Aegis%20support`}>
            Contact support
          </a>
        </Button>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-9 animate-pulse rounded-lg bg-muted" />
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <div key={col} className="h-8 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      ))}
    </div>
  );
}
