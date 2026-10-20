"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Crosshair, Focus, Network, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RISK_COLORS, scoreToLevel } from "@/config/risk";
import type { NetworkEdge, NetworkNode } from "@/lib/data/network";
import { neighbourhood, reachAt, adjacencyMap } from "@/lib/network/graph-model";
import { cn, formatCompactNumber } from "@/lib/utils";

const KIND_LABELS: Record<NetworkNode["kind"], string> = {
  individual: "Individual",
  company: "Company",
  intermediary: "Intermediary",
};

/**
 * The inspector for a tapped bead.
 *
 * The headline number is the answer to the first question an analyst asks of a
 * graph: how many entities is this one connected to? It is followed by the
 * direction split, one and two-hop reach, and the counterparty list ordered by
 * routed value so the strongest relationship is always at the top.
 */
export function NodeInspector({
  selected,
  edges,
  nodeById,
  onSelect,
  onClear,
  onFocus,
}: {
  selected: NetworkNode;
  edges: NetworkEdge[];
  nodeById: Map<string, NetworkNode>;
  onSelect: (id: string) => void;
  onClear: () => void;
  onFocus: (id: string) => void;
}) {
  const model = React.useMemo(
    () => neighbourhood(selected.id, edges, nodeById),
    [selected.id, edges, nodeById],
  );
  const adjacency = React.useMemo(() => adjacencyMap(edges), [edges]);
  const reach2 = React.useMemo(() => reachAt(adjacency, selected.id, 2), [adjacency, selected.id]);

  const strongest = model.links[0];
  const riskLevel = scoreToLevel(selected.averageScore);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="min-w-0">
          <p className="label-xs">Selected entity</p>
          <h3 className="mt-1 truncate text-[15px] font-semibold leading-5">{selected.label}</h3>
          <p className="panel-caption num mt-1">
            {selected.country} · {KIND_LABELS[selected.kind]} · {selected.accountCount}{" "}
            {selected.accountCount === 1 ? "account" : "accounts"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-tile border border-[#F0B250]/30 bg-[#F0B250]/[0.07] px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11.5px] text-[#F0B250]/85">
                Connected to
              </p>
              <p className="num mt-1 text-[30px] font-semibold leading-8">
                {model.degree}
                <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                  {model.degree === 1 ? "entity" : "entities"}
                </span>
              </p>
            </div>
            <Network className="mt-1 size-4 text-[#F0B250]" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-chart-2">
              <ArrowUpRight className="size-3" aria-hidden="true" />
              <span className="num">{model.outDegree}</span> paid
            </span>
            <span className="inline-flex items-center gap-1 text-risk-high">
              <ArrowDownLeft className="size-3" aria-hidden="true" />
              <span className="num">{model.inDegree}</span> received from
            </span>
            <span className="num ml-auto text-muted-foreground">
              {reach2.size - 1} within 2 hops
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="chip" style={{ borderColor: `${RISK_COLORS[riskLevel]}55` }}>
            avg score <span className="num">{selected.averageScore}</span>
          </span>
          <span className="chip" style={{ borderColor: `${RISK_COLORS[riskLevel]}55` }}>
            peak <span className="num">{selected.maxScore}</span>
          </span>
          {selected.pep ? (
            <span className="chip border-risk-critical/40 text-risk-critical">PEP</span>
          ) : null}
          {selected.nominee ? (
            <span className="chip border-chart-3/40 text-chart-3">Nominee director</span>
          ) : null}
          {model.flagged > 0 ? (
            <span className="chip border-risk-high/40 text-risk-high">
              <span className="num">{model.flagged}</span> flagged flows
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Sent out",
              value: formatCompactNumber(selected.outValue),
              hint: `${selected.outCount} transfers`,
            },
            {
              label: "Received",
              value: formatCompactNumber(selected.inValue),
              hint: `${selected.inCount} transfers`,
            },
            {
              label: "Pass-through",
              value:
                selected.inValue > 0
                  ? `${Math.round((selected.outValue / selected.inValue) * 100)}%`
                  : "—",
              hint: "outbound vs inbound",
            },
            {
              label: "Strongest link",
              value: strongest ? formatCompactNumber(strongest.out + strongest.in) : "—",
              hint: strongest ? strongest.node.label : "no counterparty",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-tile border border-border/70 bg-elevated/50 px-2.5 py-2"
            >
              <dt className="text-[11.5px] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="num mt-1 truncate text-[15px] font-medium leading-5">{item.value}</dd>
              <dd className="num truncate text-[10.5px] text-muted-foreground">{item.hint}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[11.5px]"
            onClick={() => onFocus(selected.id)}
          >
            <Focus className="size-3.5" aria-hidden="true" /> Focus
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]">
            <Link href={`/app/transactions?q=${encodeURIComponent(selected.label)}`}>
              <Crosshair className="size-3.5" aria-hidden="true" /> Transactions
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-[11.5px]">
            <Link href={`/app/network/${selected.id}`}>
              Full profile <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div>
          <p className="label-xs mb-2">Connections</p>
          <ul className="space-y-0.5">
            {model.links.length === 0 ? (
              <li className="text-[11.5px] text-muted-foreground">
                No connections in this window.
              </li>
            ) : (
              model.links.map((row) => (
                <li key={row.node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.node.id)}
                    className="flex w-full items-center gap-2 rounded-tile px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: RISK_COLORS[scoreToLevel(row.node.averageScore)] }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px]">{row.node.label}</span>
                      <span className={cn("num block text-[10.5px] text-muted-foreground")}>
                        {row.out > 0 ? (
                          <span className="text-chart-2">out {formatCompactNumber(row.out)}</span>
                        ) : null}
                        {row.out > 0 && row.in > 0 ? " · " : null}
                        {row.in > 0 ? (
                          <span className="text-risk-high">in {formatCompactNumber(row.in)}</span>
                        ) : null}
                        {` · ${row.count} ${row.count === 1 ? "transfer" : "transfers"}`}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[11px] text-muted-foreground">
                      {row.score}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
