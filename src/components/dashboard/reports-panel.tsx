"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, RefreshCw } from "lucide-react";

import { createReport, getReportDownloadUrl } from "@/app/(app)/app/reports/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_KIND_LABELS, REPORT_KINDS, type ReportKind } from "@/config/reports";
import { cn } from "@/lib/utils";

export interface ReportListRow {
  id: string;
  kind: ReportKind;
  from: string;
  to: string;
  status: string;
  format: string;
  rowCount: number | null;
  error: string | null;
  createdAt: string;
  requesterName: string | null;
}

const statusTone: Record<string, string> = {
  ready: "bg-risk-low/15 text-risk-low",
  running: "bg-risk-medium/15 text-risk-medium",
  queued: "bg-muted text-muted-foreground",
  failed: "bg-risk-critical/15 text-risk-critical",
};

function isoDay(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function ReportsPanel({
  rows,
  role,
  kindCounts,
}: {
  rows: ReportListRow[];
  role: string;
  kindCounts: Record<ReportKind, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<ReportKind>("sar_summary");
  const [format, setFormat] = React.useState<"csv" | "pdf">("pdf");
  const [from, setFrom] = React.useState(isoDay(-30));
  const [to, setTo] = React.useState(isoDay(0));

  const submit = async () => {
    setPending(true);
    const result = await createReport({ kind, from, to, format });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  };

  const download = async (reportId: string) => {
    setDownloading(reportId);
    const result = await getReportDownloadUrl(reportId);
    setDownloading(null);
    if (!result.ok || !result.url) {
      toast.error(result.message);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {REPORT_KINDS.map((value) => (
          <div key={value} className="panel px-4 py-3">
            <p className="label-xs">{REPORT_KIND_LABELS[value]}</p>
            <p className="metric-value mt-1">{kindCounts[value] ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {(kindCounts[value] ?? 0) === 1 ? "file generated" : "files generated"}
            </p>
          </div>
        ))}
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground">
          Reports are rendered server-side and stored privately. Download links are signed and expire after two minutes.
        </p>
        {role !== "viewer" ? (
          <Button size="sm" className="h-8 text-[12px]" onClick={() => setOpen(true)}>
            <FileText aria-hidden="true" className="size-3.5" /> Generate report
          </Button>
        ) : null}
      </div>

      <div className="panel overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <caption className="sr-only">Generated reports.</caption>
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Period</th>
              <th scope="col">Format</th>
              <th scope="col" className="text-right">Rows</th>
              <th scope="col">Requested</th>
              <th scope="col" className="text-right">Status</th>
              <th scope="col" className="text-right">File</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="text-left font-normal">
                  <span className="block text-[12px] font-medium">{REPORT_KIND_LABELS[row.kind]}</span>
                  <span className="num block text-[11px] text-muted-foreground">{row.id.slice(0, 8)}</span>
                </th>
                <td className="num whitespace-nowrap text-muted-foreground">
                  {row.from} → {row.to}
                </td>
                <td className="text-[11px]">{row.format}</td>
                <td className="num text-right">{row.rowCount?.toLocaleString("en-US") ?? "—"}</td>
                <td className="text-[12px]">
                  <span className="block">{row.requesterName ?? "Former member"}</span>
                  <span className="num block text-[11px] text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(row.createdAt))}
                  </span>
                </td>
                <td className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium capitalize",
                      statusTone[row.status] ?? "bg-muted",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                    {row.status}
                  </span>
                  {row.error ? (
                    <span className="mt-1 block max-w-48 text-[11px] text-risk-critical">{row.error}</span>
                  ) : null}
                </td>
                <td className="text-right">
                  {row.status === "ready" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={downloading === row.id}
                      onClick={() => void download(row.id)}
                    >
                      <Download aria-hidden="true" className="size-3" />
                      {downloading === row.id ? "Signing…" : "Download"}
                    </Button>
                  ) : row.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      disabled
                      title="Regenerate this report from the form"
                    >
                      <RefreshCw aria-hidden="true" className="size-3" /> Retry
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Processing…</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[12px] text-muted-foreground">
                  No reports yet. Generate a SAR summary or audit export to start the evidence trail.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate a report</DialogTitle>
            <DialogDescription>
              The export runs against this organization only. Dates are UTC calendar days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Report type</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
                <SelectTrigger aria-label="Report type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {REPORT_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="report-from" className="text-xs">From</Label>
                <Input id="report-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-to" className="text-xs">To</Label>
                <Input id="report-to" type="date" value={to} min={from} max={isoDay(0)} onChange={(event) => setTo(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as "csv" | "pdf")}>
                <SelectTrigger aria-label="Report format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF — examiner copy</SelectItem>
                  <SelectItem value="csv">CSV — data export</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={pending}>
              {pending ? "Rendering…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
