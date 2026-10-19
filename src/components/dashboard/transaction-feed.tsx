"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Download, Search, SlidersHorizontal, X } from "lucide-react";

import { TransactionDrawer } from "@/components/dashboard/transaction-drawer";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionFilters, TransactionListRow } from "@/lib/data/transactions";
import { cn, formatAmount } from "@/lib/utils";

const RISK_OPTIONS = ["critical", "high", "medium", "low"] as const;
const STATUS_OPTIONS = ["settled", "pending", "blocked", "reversed"] as const;

function buildQuery(filters: TransactionFilters, overrides: Partial<Record<string, string>> = {}) {
  const params = new URLSearchParams();
  if (filters.risk.length) params.set("risk", filters.risk.join(","));
  if (filters.corridor) params.set("corridor", filters.corridor);
  if (filters.status) params.set("status", filters.status);
  if (filters.minAmount !== null) params.set("min", String(filters.minAmount));
  if (filters.maxAmount !== null) params.set("max", String(filters.maxAmount));
  if (filters.query) params.set("q", filters.query);
  if (filters.sort !== "created_at") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("dir", filters.direction);
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  return query ? `/app/transactions?${query}` : "/app/transactions";
}

function time(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

export function TransactionFeed({
  rows,
  filters,
  corridors,
  matched,
}: {
  rows: TransactionListRow[];
  filters: TransactionFilters;
  corridors: string[];
  matched: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(filters);
  const [showFilters, setShowFilters] = React.useState(true);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [exportMessage, setExportMessage] = React.useState("");

  React.useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 12,
  });

  const apply = (next: TransactionFilters) => {
    setDraft(next);
    router.push(buildQuery(next));
  };

  const toggleRisk = (level: (typeof RISK_OPTIONS)[number]) => {
    const nextRisk = draft.risk.includes(level)
      ? draft.risk.filter((value) => value !== level)
      : [...draft.risk, level];
    apply({ ...draft, risk: nextRisk });
  };

  const sortBy = (column: TransactionFilters["sort"]) => {
    const direction = draft.sort === column && draft.direction === "desc" ? "asc" : "desc";
    apply({ ...draft, sort: column, direction });
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = ["external_id", "created_at_utc", "sender", "receiver", "corridor", "amount", "currency", "amount_base_usd", "risk_score", "risk_level", "status"];
    const lines = rows.map((row) =>
      [
        row.externalId,
        row.createdAt,
        row.senderName,
        row.receiverName,
        `${row.senderCountry}-${row.receiverCountry}`,
        row.amount,
        row.currency,
        row.amountBase,
        row.riskScore,
        row.riskLevel,
        row.status,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aegis-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportMessage(
      rows.length >= 200
        ? "Exported the 200 most recent matching rows. Narrow the filters for a complete export."
        : `Exported ${rows.length} rows.`,
    );
  };

  const activeFilterCount =
    draft.risk.length + (draft.corridor ? 1 : 0) + (draft.status ? 1 : 0) + (draft.minAmount !== null ? 1 : 0) + (draft.maxAmount !== null ? 1 : 0) + (draft.query ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="panel px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex min-w-0 flex-1 items-center"
            onSubmit={(event) => {
              event.preventDefault();
              apply(draft);
            }}
          >
            <div className="relative min-w-0 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={draft.query}
                onChange={(event) => setDraft({ ...draft, query: event.target.value })}
                placeholder="Search payment id, sender or receiver"
                aria-label="Search transactions"
                className="h-8 border-transparent bg-muted/50 pl-8 text-[12px] focus-visible:border-border"
              />
            </div>
          </form>

          <div className="flex items-center gap-1.5">
            <div className="hidden items-center rounded-[7px] border border-border p-0.5 lg:flex" role="group" aria-label="Risk level">
              {RISK_OPTIONS.map((level) => {
                const active = draft.risk.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleRisk(level)}
                    className={cn(
                      "rounded-[5px] px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                      active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {level}
                  </button>
                );
              })}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal aria-hidden="true" className="size-3.5" /> Filters
              {activeFilterCount > 0 ? (
                <span className="num rounded-[4px] bg-foreground px-1 text-[10px] leading-4 text-background">{activeFilterCount}</span>
              ) : null}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={exportCsv} disabled={rows.length === 0}>
              <Download aria-hidden="true" className="size-3.5" /> Export
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-2.5 grid gap-2 border-t border-border/60 pt-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="corridor" className="label-xs">Corridor</Label>
              <Select
                value={draft.corridor || "all"}
                onValueChange={(value) => apply({ ...draft, corridor: value === "all" ? "" : value })}
              >
                <SelectTrigger id="corridor" className="h-8 text-[12px]">
                  <SelectValue placeholder="All corridors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All corridors</SelectItem>
                  {corridors.map((corridor) => (
                    <SelectItem key={corridor} value={corridor}>{corridor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status" className="label-xs">Settlement status</Label>
              <Select
                value={draft.status || "all"}
                onValueChange={(value) => apply({ ...draft, status: value === "all" ? "" : value })}
              >
                <SelectTrigger id="status" className="h-8 text-[12px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="min-amount" className="label-xs">Min amount (USD)</Label>
              <Input
                id="min-amount"
                type="number"
                min={0}
                className="h-8 text-[12px]"
                placeholder="0"
                value={draft.minAmount ?? ""}
                onChange={(event) => setDraft({ ...draft, minAmount: event.target.value ? Number(event.target.value) : null })}
                onBlur={() => apply(draft)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="max-amount" className="label-xs">Max amount (USD)</Label>
              <Input
                id="max-amount"
                type="number"
                min={0}
                className="h-8 text-[12px]"
                placeholder="No limit"
                value={draft.maxAmount ?? ""}
                onChange={(event) => setDraft({ ...draft, maxAmount: event.target.value ? Number(event.target.value) : null })}
                onBlur={() => apply(draft)}
              />
            </div>

            {activeFilterCount > 0 ? (
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                  onClick={() =>
                    apply({
                      ...draft,
                      risk: [],
                      corridor: "",
                      status: "",
                      minAmount: null,
                      maxAmount: null,
                      query: "",
                    })
                  }
                >
                  <X aria-hidden="true" className="size-3" /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="num">
            {matched.toLocaleString("en-US")} matching · showing {rows.length}
          </span>
          {exportMessage ? (
            <span role="status">{exportMessage}</span>
          ) : (
            <span>Sorted by {filters.sort.replace(/_/g, " ")}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div
              role="row"
              className="grid grid-cols-[112px_104px_minmax(0,1.5fr)_minmax(0,1.5fr)_72px_128px_88px_76px_72px] gap-2 border-b border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground"
            >
              <button type="button" className="flex items-center gap-1 text-left" onClick={() => sortBy("created_at")}>
                Time {filters.sort === "created_at" ? filters.direction === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
              </button>
              <span>ID</span>
              <span>Sender</span>
              <span>Receiver</span>
              <span>Corridor</span>
              <button type="button" className="flex items-center justify-end gap-1" onClick={() => sortBy("amount")}>
                Amount {filters.sort === "amount" ? filters.direction === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
              </button>
              <button type="button" className="flex items-center justify-end gap-1" onClick={() => sortBy("risk_score")}>
                Risk {filters.sort === "risk_score" ? filters.direction === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
              </button>
              <span className="text-right">Level</span>
              <span className="text-right">Status</span>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-14 text-center text-sm text-muted-foreground">
                No transactions match these filters. Clear a filter or widen the amount range.
              </p>
            ) : (
              <div ref={parentRef} className="max-h-[calc(100dvh-300px)] overflow-y-auto" tabIndex={0} aria-label="Transaction results">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((item) => {
                    const row = rows[item.index]!;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelected(row.id)}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: item.size, transform: `translateY(${item.start}px)` }}
                        className="grid grid-cols-[112px_104px_minmax(0,1.5fr)_minmax(0,1.5fr)_72px_128px_88px_76px_72px] items-center gap-2 border-b border-border/60 px-3 text-left text-[12px] transition-colors hover:bg-muted/40 focus-visible:bg-muted/60"
                      >
                        <span className="num truncate text-[11px] text-muted-foreground">{time(row.createdAt)}</span>
                        <span className="num truncate text-[11px]">{row.externalId}</span>
                        <span className="truncate">{row.senderName}</span>
                        <span className="truncate">{row.receiverName}</span>
                        <span className="num">{row.senderCountry}→{row.receiverCountry}</span>
                        <span className="num truncate text-right">{formatAmount(row.amount, row.currency)}</span>
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                row.riskScore >= 85 ? "bg-risk-critical" : row.riskScore >= 70 ? "bg-risk-high" : row.riskScore >= 40 ? "bg-risk-medium" : "bg-risk-low",
                              )}
                              style={{ width: `${row.riskScore}%` }}
                            />
                          </span>
                          <span className="num w-6">{Math.round(row.riskScore)}</span>
                        </span>
                        <span className="flex justify-end"><RiskBadge level={row.riskLevel} /></span>
                        <span className="truncate text-right capitalize text-muted-foreground">{row.status}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TransactionDrawer transactionId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
