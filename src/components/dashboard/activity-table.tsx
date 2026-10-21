"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShieldAlert } from "lucide-react";

import type { FeedRow } from "@/lib/data/overview";
import { cn, formatCurrency } from "@/lib/utils";

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key === "settled" || key === "completed") return { label: "Completed", className: "text-risk-low" };
  if (key === "review" || key === "investigating" || key === "flagged") {
    return { label: "In review", className: "text-risk-medium" };
  }
  if (key === "rejected" || key === "failed") return { label: "Rejected", className: "text-risk-critical" };
  return { label: status.charAt(0).toUpperCase() + status.slice(1), className: "text-muted-foreground" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

/**
 * The reference's "Recent activities" card: a compact table with a search box
 * and a one-click filter. Search covers the payment reference and both sides;
 * the filter narrows to flagged payments.
 */
export function ActivityTable({ rows }: { rows: FeedRow[] }) {
  const [query, setQuery] = React.useState("");
  const [flaggedOnly, setFlaggedOnly] = React.useState(false);

  const filtered = rows.filter((row) => {
    if (flaggedOnly && row.riskLevel !== "high" && row.riskLevel !== "critical") return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      row.externalId.toLowerCase().includes(needle) ||
      row.senderName.toLowerCase().includes(needle) ||
      row.receiverName.toLowerCase().includes(needle) ||
      `${row.senderCountry}-${row.receiverCountry}`.toLowerCase().includes(needle)
    );
  });

  return (
    <section aria-labelledby="activity-heading" className="panel flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/55 px-5 py-3.5">
        <h2 id="activity-heading" className="panel-title">
          Recent activity
        </h2>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search recent payments</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-8 w-[150px] rounded-lg border border-border bg-background pl-8 pr-2 text-[12px] outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent/60 sm:w-[190px]"
            />
          </label>
          <button
            type="button"
            onClick={() => setFlaggedOnly((current) => !current)}
            aria-pressed={flaggedOnly}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
              flaggedOnly
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Flagged
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="flex-1 px-5 py-12 text-center text-[12px] text-muted-foreground">
          No payments match this filter.
        </p>
      ) : (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="table-base">
            <caption className="sr-only">Most recent scored payments</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Payment</th>
                <th scope="col">Activity</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col" className="pr-5">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 6).map((row) => {
                const tone = statusTone(row.status);
                return (
                  <tr key={row.id}>
                    <td className="pl-5">
                      <Link
                        href={`/app/transactions/${row.id}`}
                        className="num text-[12px] font-medium hover:underline"
                      >
                        {row.externalId}
                      </Link>
                    </td>
                    <td className="max-w-[260px]">
                      <span className="block truncate text-[12px]">{row.senderName}</span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">
                        {row.senderCountry} → {row.receiverCountry} · {row.receiverName}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap text-[12px] font-medium">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                    <td>
                      <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", tone.className)}>
                        <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                        {tone.label}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap pr-5 text-[11px] text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
