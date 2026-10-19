"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { RISK_COLORS, SCORE_BANDS } from "@/config/risk";
import { createClient } from "@/lib/supabase/client";
import type { FeedRow } from "@/lib/data/overview";
import { cn, formatAmount } from "@/lib/utils";

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

const statusTone: Record<string, string> = {
  settled: "text-risk-low",
  pending: "text-muted-foreground",
  review: "text-risk-medium",
  blocked: "text-risk-critical",
};

export function MiniFeed({ initialRows, organizationId }: { initialRows: FeedRow[]; organizationId: string }) {
  const [rows, setRows] = React.useState(initialRows);
  const [fresh, setFresh] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("overview-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const next: FeedRow = {
            id: String(row.id),
            externalId: String(row.external_id ?? ""),
            createdAt: String(row.created_at),
            senderName: String(row.sender_name ?? ""),
            receiverName: String(row.receiver_name ?? ""),
            senderCountry: String(row.sender_country ?? ""),
            receiverCountry: String(row.receiver_country ?? ""),
            amount: Number(row.amount ?? 0),
            currency: String(row.currency ?? "USD"),
            amountBase: Number(row.amount_base ?? 0),
            riskScore: Number(row.risk_score ?? 0),
            riskLevel: (row.risk_level as FeedRow["riskLevel"]) ?? "low",
            status: String(row.status ?? "settled"),
          };
          setRows((current) => [next, ...current].slice(0, 10));
          setFresh((current) => new Set(current).add(next.id));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return (
    <section aria-labelledby="live-feed-heading" className="panel">
      <div className="panel-head">
        <div>
          <h2 id="live-feed-heading" className="panel-title">
            Live transaction stream
          </h2>
          <p className="panel-caption mt-1">
            <span className="mr-1.5 inline-block size-1.5 animate-pulse-soft rounded-full bg-risk-low align-middle" aria-hidden="true" />
            Streaming inserts, scored on arrival · newest first
          </p>
        </div>
        <Link
          href="/app/transactions"
          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Open feed
        </Link>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <caption className="sr-only">Most recent scored payments</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[92px] pl-5">Time (UTC)</th>
              <th scope="col" className="w-[92px]">Corridor</th>
              <th scope="col">Payer → beneficiary</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col" className="w-[132px]">Risk score</th>
              <th scope="col" className="w-[84px] pr-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[12px] text-muted-foreground">
                  No transactions yet. Send a batch to the ingest API to see it here.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const score = Math.round(row.riskScore);
                const flagged = score >= SCORE_BANDS.alert;
                return (
                  <tr key={row.id} className={cn(fresh.has(row.id) && "animate-flash motion-reduce:animate-none")}>
                    <td className="num whitespace-nowrap pl-5 text-[11.5px] text-muted-foreground">{timeLabel(row.createdAt)}</td>
                    <td className="num whitespace-nowrap text-[11.5px]">
                      {row.senderCountry}
                      <ArrowRight className="mx-1 inline size-3 text-muted-foreground/60" aria-hidden="true" />
                      {row.receiverCountry}
                    </td>
                    <td className="max-w-[280px]">
                      <span className="block truncate text-[12.5px]">{row.senderName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{row.receiverName}</span>
                    </td>
                    <td className="num whitespace-nowrap text-right text-[12.5px]">
                      {formatAmount(row.amount, row.currency)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={`Risk score ${score}`}
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(3, score)}%`,
                              background: RISK_COLORS[row.riskLevel] ?? "rgb(var(--muted-foreground))",
                              opacity: flagged ? 1 : 0.65,
                            }}
                          />
                        </span>
                        <span className={cn("num text-[11.5px]", flagged ? "text-foreground" : "text-muted-foreground")}>
                          {score}
                        </span>
                      </div>
                    </td>
                    <td className="pr-5 text-right">
                      <span className={cn("text-[11.5px] capitalize", statusTone[row.status] ?? "text-muted-foreground")}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
        Scores at or above the cutoff of {SCORE_BANDS.alert} raise an alert automatically.
      </div>
    </section>
  );
}
