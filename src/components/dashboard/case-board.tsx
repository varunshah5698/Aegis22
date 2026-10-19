"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus, Search } from "lucide-react";

import { createCase } from "@/app/(app)/app/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUSES,
  type CasePriority,
  type CaseRow,
  type CaseStatus,
} from "@/lib/cases/types";
import { cn } from "@/lib/utils";

const priorityTone: Record<CasePriority, string> = {
  low: "bg-risk-low/15 text-risk-low",
  medium: "bg-risk-medium/20 text-[#6b4a00] dark:text-risk-medium",
  high: "bg-risk-high/15 text-risk-high",
  critical: "bg-risk-critical/15 text-risk-critical",
};

function statusTone(status: CaseStatus): string {
  if (status === "open") return "bg-risk-medium/15 text-risk-medium";
  if (status === "in_review") return "bg-muted text-foreground";
  return "bg-muted/60 text-muted-foreground";
}

export function CaseBoard({
  rows,
  filters,
  role,
}: {
  rows: CaseRow[];
  filters: { status?: string | undefined; priority?: string | undefined; q?: string | undefined };
  role: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(filters.q ?? "");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [priority, setPriority] = React.useState<CasePriority>("medium");

  const navigate = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { ...filters, ...patch };
    if (next.status) params.set("status", next.status);
    if (next.priority) params.set("priority", next.priority);
    if (next.q) params.set("q", next.q);
    const suffix = params.toString();
    router.push(`/app/cases${suffix ? `?${suffix}` : ""}`);
  };

  const submit = async () => {
    setPending(true);
    const result = await createCase({ title, summary, priority });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setTitle("");
    setSummary("");
    setPriority("medium");
    setOpen(false);
    if (result.caseId) router.push(`/app/cases/${result.caseId}`);
    else router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-2 px-3 py-2.5">
        <form
          className="relative min-w-48 flex-1 md:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ q: query.trim() || undefined });
          }}
          role="search"
        >
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case title or summary"
            aria-label="Search cases"
            className="h-8 border-transparent bg-muted/50 pl-8 text-[12px] focus-visible:border-border"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
          <div className="flex items-center rounded-[7px] border border-border p-0.5">
            <button
              type="button"
              onClick={() => navigate({ status: undefined })}
              aria-pressed={!filters.status}
              className={cn(
                "rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                !filters.status ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {CASE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => navigate({ status })}
                aria-pressed={filters.status === status}
                className={cn(
                  "rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                  filters.status === status
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {CASE_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={filters.priority ?? "all"}
            onValueChange={(value) => navigate({ priority: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="h-8 w-[140px] text-[12px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {CASE_PRIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CASE_PRIORITY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {role !== "viewer" ? (
            <Button size="sm" className="h-8 text-[12px]" onClick={() => setOpen(true)}>
              <FolderPlus aria-hidden="true" className="size-3.5" /> New case
            </Button>
          ) : null}
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <caption className="sr-only">Cases matching the current filters.</caption>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Owner</th>
              <th scope="col" className="text-right">Alerts</th>
              <th scope="col" className="text-right">Notes</th>
              <th scope="col" className="text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="max-w-72 text-left font-normal">
                  <Link href={`/app/cases/${row.id}`} className="block truncate text-[12px] font-medium hover:underline">
                    {row.title}
                  </Link>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.summary || "No summary yet"}
                  </span>
                </th>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
                      statusTone(row.status),
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                    {CASE_STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
                      priorityTone[row.priority],
                    )}
                  >
                    {CASE_PRIORITY_LABELS[row.priority]}
                  </span>
                </td>
                <td className="text-[12px]">
                  {row.ownerName ?? <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="num text-right">{row.alertCount}</td>
                <td className="num text-right">{row.noteCount}</td>
                <td className="num whitespace-nowrap text-right text-[11px] text-muted-foreground">
                  {new Intl.DateTimeFormat("en-GB", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(row.updatedAt))}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[12px] text-muted-foreground">
                  No cases match these filters. Clear them, or open a case from an alert.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {rows.length} case{rows.length === 1 ? "" : "s"} shown. Cases group related alerts, entities and notes into one
        investigation file for audit.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a case</DialogTitle>
            <DialogDescription>
              Cases collect alerts, notes and linked entities so regulators can follow the reasoning end to end.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="case-title-new" className="text-xs">Title</Label>
              <Input
                id="case-title-new"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Structuring cluster on the PK-MM corridor"
                maxLength={160}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="case-summary" className="text-xs">Summary</Label>
              <Textarea
                id="case-summary"
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What pattern triggered this investigation?"
                maxLength={4000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as CasePriority)}>
                <SelectTrigger aria-label="Case priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CASE_PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={pending || title.trim().length < 3}>
              {pending ? "Opening…" : "Open case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
