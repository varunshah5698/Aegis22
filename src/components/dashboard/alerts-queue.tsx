"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, UserCheck } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkAlertAction } from "@/app/(app)/app/alerts/actions";
import { SAVED_VIEWS, type AlertQueueRow, type SavedViewId } from "@/lib/alerts/types";
import { slaLabel, slaState, STATUS_LABELS } from "@/lib/alerts/transitions";
import { cn, formatCurrency } from "@/lib/utils";

export function AlertsQueue({
  rows,
  view,
  status,
  severity,
}: {
  rows: AlertQueueRow[];
  view: SavedViewId;
  status: string;
  severity: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [now, setNow] = React.useState(Date.now());
  const [pending, setPending] = React.useState(false);
  const [confirmBulk, setConfirmBulk] = React.useState<null | "assign_me" | "escalate" | "false_positive">(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: "assign_me" | "escalate" | "false_positive") => {
    setPending(true);
    const result = await bulkAlertAction([...selected], action);
    setPending(false);
    setConfirmBulk(null);
    if (result.ok) {
      toast.success(result.message);
      setSelected(new Set());
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (view !== "all") params.set("view", view);
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `/app/alerts?${query}` : "/app/alerts");
  };

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <nav aria-label="Saved views" className="flex flex-wrap items-center gap-1">
          {SAVED_VIEWS.map((item) => (
            <Link
              key={item.id}
              href={item.id === "all" ? "/app/alerts" : `/app/alerts?view=${item.id}`}
              aria-current={item.id === view ? "page" : undefined}
              className={cn(
                "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
                item.id === view
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Select value={severity || "all"} onValueChange={(value) => setParam("severity", value === "all" ? "" : value)}>
            <SelectTrigger className="h-9 w-[140px] text-[12.5px]" aria-label="Severity filter">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "open"} onValueChange={(value) => setParam("status", value === "open" ? "" : value)}>
            <SelectTrigger className="h-9 w-[158px] text-[12.5px]" aria-label="Status filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false_positive">False positive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-panel border border-accent/40 bg-accent/10 px-3 py-2">
          <span className="text-[12px] font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={pending} onClick={() => setConfirmBulk("assign_me")}>
            <UserCheck aria-hidden="true" className="size-3.5" /> Assign to me
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={pending} onClick={() => setConfirmBulk("escalate")}>
            Escalate
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={pending} onClick={() => setConfirmBulk("false_positive")}>
            False positive
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="panel overflow-x-auto">
        <table className="table-base min-w-[960px]">
          <caption className="sr-only">Alert queue</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              <th scope="col" className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all alerts on this page"
                />
              </th>
              <th scope="col">Severity</th>
              <th scope="col">Alert</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col">Corridor</th>
              <th scope="col">Status</th>
              <th scope="col">Assignee</th>
              <th scope="col" className="text-right">SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nothing in this view. Switch saved views or widen the status filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const state = slaState(row.dueAt, now);
                return (
                  <tr key={row.id}>
                    <td>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.title}`}
                      />
                    </td>
                    <td><RiskBadge level={row.severity} /></td>
                    <td className="max-w-[340px]">
                      <Link href={`/app/alerts/${row.id}`} className="block truncate text-[12.5px] font-medium hover:underline">
                        {row.title}
                      </Link>
                      <span className="num text-[10.5px] text-muted-foreground">{row.externalId}</span>
                    </td>
                    <td className="num whitespace-nowrap text-right text-[12.5px]">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                    <td className="num text-[12px]">{row.corridor}</td>
                    <td className="text-[12px]">{STATUS_LABELS[row.status]}</td>
                    <td className="text-[12px] text-muted-foreground">{row.assigneeName ?? "Unassigned"}</td>
                    <td className="whitespace-nowrap text-right">
                      <span
                        className={cn(
                          "num inline-flex items-center gap-1.5 text-[11.5px]",
                          state === "breached" && "text-risk-critical",
                          state === "warning" && "text-risk-medium",
                          state === "ok" && "text-risk-low",
                        )}
                      >
                        <Clock className="size-3" aria-hidden="true" />
                        {slaLabel(row.dueAt, now)}
                      </span>
                      <span className="ml-auto mt-1 block h-1 w-20 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            state === "breached"
                              ? "w-full bg-risk-critical"
                              : state === "warning"
                                ? "w-2/3 bg-risk-medium"
                                : "w-1/4 bg-risk-low",
                          )}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmBulk !== null}
        onOpenChange={(open) => (!open ? setConfirmBulk(null) : undefined)}
        title={
          confirmBulk === "assign_me"
            ? "Assign these alerts to you?"
            : confirmBulk === "escalate"
              ? "Escalate these alerts?"
              : "Mark these alerts as false positives?"
        }
        description={`${selected.size} alert${selected.size === 1 ? "" : "s"} will change. ${
          confirmBulk === "false_positive" ? "False positives are closed with a reason and feed tuning." : "The change is recorded in each alert timeline."
        }`}
        confirmLabel={pending ? "Applying…" : "Apply"}
        onConfirm={() => confirmBulk && void runBulk(confirmBulk)}
      />
    </div>
  );
}
