import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { REPORT_KIND_LABELS, type ReportKind } from "@/config/reports";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export type { ReportKind } from "@/config/reports";

export interface ReportPayload {
  title: string;
  organization: string;
  range: string;
  generatedAt: string;
  columns: string[];
  align: Array<"left" | "right">;
  rows: string[][];
}

const MAX_ROWS = 5_000;

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(payload: ReportPayload): string {
  const header = payload.columns.map(csvCell).join(",");
  const body = payload.rows.map((row) => row.map((cell) => csvCell(cell ?? "")).join(","));
  return [`# ${payload.title} — ${payload.organization}`, `# ${payload.range}`, header, ...body].join("\r\n") + "\r\n";
}

export async function toPdf(payload: ReportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${payload.title} — ${payload.organization}`);
  pdf.setAuthor("Aegis");
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 842;
  const height = 595;
  const margin = 36;
  const rowHeight = 14;
  const usable = width - margin * 2;
  const weights = payload.columns.map((_, index) => (payload.align[index] === "right" ? 0.7 : 1.6));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const columnWidths = weights.map((weight) => (weight / totalWeight) * usable);

  // The standard PDF fonts use WinAnsi encoding, which has no glyphs for arrows
  // or CJK characters. Fold them to ASCII before measuring or drawing.
  const pdfSafe = (value: string) =>
    value
      .replace(/→/g, "->")
      .replace(/←/g, "<-")
      .replace(/[≥]/g, ">=")
      .replace(/[≤]/g, "<=")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\u0000-\u00ff]/g, "?");

  const truncate = (value: string, maxWidth: number, size: number, useBold = false) => {
    let text = pdfSafe(value).replace(/\s+/g, " ");
    const measure = (input: string) => (useBold ? bold : font).widthOfTextAtSize(input, size);
    if (measure(text) <= maxWidth) return text;
    while (text.length > 1 && measure(`${text}…`) > maxWidth) text = text.slice(0, -1);
    return `${text}…`;
  };

  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const header = () => {
    page.drawText(truncate(payload.title, usable, 15, true), {
      x: margin,
      y,
      size: 15,
      font: bold,
      color: rgb(0.08, 0.09, 0.1),
    });
    y -= 18;
    page.drawText(pdfSafe(`${payload.organization} · ${payload.range} · generated ${payload.generatedAt}`), {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.4, 0.42, 0.45),
    });
    y -= 16;
    let x = margin;
    payload.columns.forEach((column, index) => {
      const columnWidth = columnWidths[index] ?? 0;
      const label = truncate(column.toUpperCase(), columnWidth - 4, 7, true);
      const labelWidth = bold.widthOfTextAtSize(label, 7);
      page.drawText(label, {
        x: payload.align[index] === "right" ? x + columnWidth - 4 - labelWidth : x,
        y,
        size: 7,
        font: bold,
        color: rgb(0.35, 0.37, 0.4),
      });
      x += columnWidth;
    });
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.6,
      color: rgb(0.8, 0.81, 0.83),
    });
    y -= rowHeight;
  };

  header();

  for (const row of payload.rows.slice(0, MAX_ROWS)) {
    if (y < margin + rowHeight) {
      page = pdf.addPage([width, height]);
      y = height - margin;
      header();
    }
    let x = margin;
    row.forEach((cell, index) => {
      const columnWidth = columnWidths[index] ?? 0;
      const text = truncate(cell ?? "", columnWidth - 4, 7.5);
      const textWidth = font.widthOfTextAtSize(text, 7.5);
      page.drawText(text, {
        x: payload.align[index] === "right" ? x + columnWidth - 4 - textWidth : x,
        y,
        size: 7.5,
        font,
        color: rgb(0.13, 0.14, 0.16),
      });
      x += columnWidth;
    });
    y -= rowHeight;
  }

  if (payload.rows.length === 0) {
    page.drawText("No records fell inside this range.", { x: margin, y, size: 9, font, color: rgb(0.4, 0.42, 0.45) });
  }

  return pdf.save();
}

function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timestamp(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export async function buildReport(
  supabase: Client,
  organization: { id: string; name: string },
  kind: ReportKind,
  from: string,
  to: string,
): Promise<ReportPayload> {
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;
  const range = `${from} → ${to} (UTC)`;
  const generatedAt = timestamp(new Date().toISOString());

  if (kind === "sar_summary") {
    const { data, error } = await supabase
      .from("alerts")
      .select(
        "id, title, severity, status, created_at, resolved_at, due_at, summary, transactions!inner(external_id, amount, currency, amount_base, risk_score, sender_name, receiver_name, sender_country, receiver_country)",
      )
      .eq("organization_id", organization.id)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw new Error(error.message);

    return {
      title: REPORT_KIND_LABELS.sar_summary,
      organization: organization.name,
      range,
      generatedAt,
      columns: [
        "Alert",
        "Raised",
        "Severity",
        "Status",
        "Transaction",
        "Sender",
        "Receiver",
        "Corridor",
        "Amount (USD)",
        "Score",
        "Resolved",
        "Resolution",
      ],
      align: ["left", "left", "left", "left", "left", "left", "left", "left", "right", "right", "left", "left"],
      rows: (data ?? []).map((alert) => {
        const transaction = Array.isArray(alert.transactions) ? alert.transactions[0] : alert.transactions;
        return [
          alert.id.slice(0, 8),
          timestamp(alert.created_at),
          alert.severity,
          alert.status.replace("_", " "),
          transaction?.external_id ?? "—",
          transaction?.sender_name ?? "—",
          transaction?.receiver_name ?? "—",
          `${transaction?.sender_country ?? ""}-${transaction?.receiver_country ?? ""}`,
          money(Number(transaction?.amount_base ?? 0)),
          String(transaction?.risk_score ?? "—"),
          timestamp(alert.resolved_at),
          alert.summary || "—",
        ];
      }),
    };
  }

  if (kind === "daily_digest") {
    const [{ data: transactions, error: txError }, { data: alerts, error: alertError }] = await Promise.all([
      supabase
        .from("transactions")
        .select("created_at, amount_base, risk_score, status")
        .eq("organization_id", organization.id)
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: true })
        .limit(20_000),
      supabase
        .from("alerts")
        .select("created_at, resolved_at, severity")
        .eq("organization_id", organization.id)
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(20_000),
    ]);
    if (txError) throw new Error(txError.message);
    if (alertError) throw new Error(alertError.message);

    const days = new Map<
      string,
      { scanned: number; value: number; flagged: number; blocked: number; raised: number; resolved: number }
    >();
    const keyOf = (value: string) => value.slice(0, 10);
    const ensure = (key: string) => {
      const entry = days.get(key) ?? { scanned: 0, value: 0, flagged: 0, blocked: 0, raised: 0, resolved: 0 };
      days.set(key, entry);
      return entry;
    };

    for (const row of transactions ?? []) {
      const entry = ensure(keyOf(row.created_at));
      entry.scanned += 1;
      entry.value += Number(row.amount_base ?? 0);
      if ((row.risk_score ?? 0) >= 70) entry.flagged += 1;
      if (row.status === "blocked") entry.blocked += 1;
    }
    for (const alert of alerts ?? []) {
      ensure(keyOf(alert.created_at)).raised += 1;
      if (alert.resolved_at) ensure(keyOf(alert.resolved_at)).resolved += 1;
    }

    const sorted = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    return {
      title: REPORT_KIND_LABELS.daily_digest,
      organization: organization.name,
      range,
      generatedAt,
      columns: ["Date (UTC)", "Scanned", "Value (USD)", "High risk", "Blocked", "Alerts raised", "Alerts resolved"],
      align: ["left", "right", "right", "right", "right", "right", "right"],
      rows: sorted.map(([day, entry]) => [
        day,
        entry.scanned.toLocaleString("en-US"),
        money(entry.value),
        entry.flagged.toLocaleString("en-US"),
        entry.blocked.toLocaleString("en-US"),
        entry.raised.toLocaleString("en-US"),
        entry.resolved.toLocaleString("en-US"),
      ]),
    };
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at, action, target_type, target_id, metadata, actor_id")
    .eq("organization_id", organization.id)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const actors = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
    (profiles ?? []).forEach((profile) => actors.set(profile.id, profile.full_name || profile.email));
  }

  return {
    title: REPORT_KIND_LABELS.audit_log,
    organization: organization.name,
    range,
    generatedAt,
    columns: ["Timestamp (UTC)", "Actor", "Action", "Target type", "Target", "Details"],
    align: ["left", "left", "left", "left", "left", "left"],
    rows: (data ?? []).map((row) => [
      timestamp(row.created_at),
      row.actor_id ? (actors.get(row.actor_id) ?? "Former member") : "System",
      row.action,
      row.target_type,
      row.target_id ?? "—",
      JSON.stringify(row.metadata ?? {}).slice(0, 180),
    ]),
  };
}
