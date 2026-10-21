"use client";

import * as React from "react";
import { Eye, EyeOff, Focus, Maximize2, Minus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkCanvas, type NetworkCanvasApi } from "@/components/dashboard/network-canvas";
import { NodeInspector } from "@/components/dashboard/node-inspector";
import { RISK_COLORS, riskGlow, type RiskLevel } from "@/config/risk";
import type { NetworkEdge, NetworkNode } from "@/lib/data/network";
import { cn, formatCompactNumber } from "@/lib/utils";

const RISK_FILTERS: Array<{ id: string; label: string; min: number }> = [
  { id: "all", label: "All", min: 0 },
  { id: "watch", label: "≥40", min: 40 },
  { id: "elevated", label: "≥60", min: 60 },
  { id: "high", label: "≥70", min: 70 },
];

const VALUE_FILTERS = [
  { id: "0", label: "Any value", min: 0 },
  { id: "100000", label: "≥ 100K", min: 100_000 },
  { id: "500000", label: "≥ 500K", min: 500_000 },
  { id: "1000000", label: "≥ 1M", min: 1_000_000 },
];

const LEGEND: RiskLevel[] = ["low", "medium", "high", "critical"];

function total(node: NetworkNode): number {
  return node.inValue + node.outValue;
}

/**
 * Interactive relationship explorer.
 *
 * The canvas owns the geometry (see NetworkCanvas and graph-model): a real 3D
 * force layout, perspective projection and light beads whose rim carries the
 * risk level. This component owns the filters, the camera scale and the
 * selection, so tapping a bead updates the inspector beside it without
 * re-running the layout.
 */
export function NetworkGraph({ nodes, edges }: { nodes: NetworkNode[]; edges: NetworkEdge[] }) {
  const canvasApi = React.useRef<NetworkCanvasApi | null>(null);
  const [query, setQuery] = React.useState("");
  const [riskMin, setRiskMin] = React.useState(0);
  const [valueMin, setValueMin] = React.useState(0);
  const [kind, setKind] = React.useState<"all" | NetworkNode["kind"]>("all");
  const [showLabels, setShowLabels] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const hoverId: string | null = null;
  const [hoverBox, setHoverBox] = React.useState<{
    x: number;
    y: number;
    label: string;
    sub: string;
    link: string;
  } | null>(null);
  const [scale, setScale] = React.useState(1);

  const nodeById = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const keptNodes = nodes.filter((node) => {
      if (node.averageScore < riskMin) return false;
      if (total(node) < valueMin) return false;
      if (kind !== "all" && node.kind !== kind) return false;
      if (needle && !`${node.label} ${node.country} ${node.kind}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
    const keptIds = new Set(keptNodes.map((node) => node.id));
    const keptEdges = edges.filter(
      (edge) => keptIds.has(edge.source) && keptIds.has(edge.target) && edge.value >= valueMin,
    );
    return { nodes: keptNodes, edges: keptEdges };
  }, [nodes, edges, query, riskMin, valueMin, kind]);

  const selected = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const selectedVisible =
    selected && visible.nodes.some((node) => node.id === selected.id) ? selected : null;

  const zoomBy = React.useCallback((factor: number) => {
    setScale((current) => Math.min(2.6, Math.max(0.55, current * factor)));
  }, []);

  const onReady = React.useCallback(() => setScale(1), []);

  const focusNeighbourhood = React.useCallback(
    (id: string) => {
      const neighbourIds = new Set<string>([id]);
      for (const edge of visible.edges) {
        if (edge.source === id) neighbourIds.add(edge.target);
        if (edge.target === id) neighbourIds.add(edge.source);
      }
      // Zoom so a typical neighbourhood fills the canvas without clipping labels.
      setScale(neighbourIds.size > 12 ? 1.35 : 1.7);
    },
    [visible.edges],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_336px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entity or country"
              aria-label="Search entities"
              className="h-9 pl-8 text-[12.5px]"
            />
          </div>

          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            aria-label="Entity kind"
            className="h-9 rounded-tile border border-border bg-elevated/60 px-2.5 text-[12.5px] text-foreground"
          >
            <option value="all">All entities</option>
            <option value="individual">Individuals</option>
            <option value="company">Companies</option>
            <option value="intermediary">Intermediaries</option>
          </select>

          <select
            value={valueMin}
            onChange={(event) => setValueMin(Number(event.target.value))}
            aria-label="Minimum value"
            className="h-9 rounded-tile border border-border bg-elevated/60 px-2.5 text-[12.5px] text-foreground"
          >
            {VALUE_FILTERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <div
            className="flex items-center rounded-tile border border-border p-0.5"
            role="group"
            aria-label="Risk filter"
          >
            {RISK_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={riskMin === option.min}
                onClick={() => setRiskMin(option.min)}
                className={cn(
                  "num rounded-[8px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                  riskMin === option.min
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-panel border border-border bg-[#070b14]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 52% at 50% 46%, rgba(96,165,250,0.12) 0%, transparent 72%), radial-gradient(42% 40% at 10% 100%, rgba(240,178,80,0.08) 0%, transparent 70%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {LEGEND.map((level) => (
                <span
                  key={level}
                  className="inline-flex items-center gap-1.5 text-[11px] text-white/60"
                >
                  <span
                    className="size-2.5 rounded-full bg-[#EEF3FB] ring-2"
                    style={{
                      boxShadow: `0 0 0 2px ${riskGlow(level, 0.55)}`,
                      ["--tw-ring-color" as string]: RISK_COLORS[level],
                    }}
                    aria-hidden="true"
                  />
                  {level}
                </span>
              ))}
              <span className="text-[11px] text-white/40">bead size = value · rim = risk</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px]"
                onClick={() => setShowLabels((value) => !value)}
              >
                {showLabels ? (
                  <EyeOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5" aria-hidden="true" />
                )}
                {showLabels ? "Hide labels" : "Show labels"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => zoomBy(1 / 1.25)}
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="num w-10 text-center text-[11px] text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => zoomBy(1.25)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fit graph"
                onClick={() => {
                  setScale(1);
                  canvasApi.current?.fit();
                }}
              >
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="relative h-[560px]">
            <NetworkCanvas
              nodes={visible.nodes}
              edges={visible.edges}
              selectedId={selectedVisible?.id ?? null}
              hoverId={hoverId}
              showLabels={showLabels}
              camera={{ yaw: -0.35, pitch: 0.3, distance: 2.4, scale, cx: 0, cy: 0, fade: 1 }}
              apiRef={canvasApi}
              className="absolute inset-0"
              onReady={onReady}
              onZoom={zoomBy}
              onSelect={(id) => setSelectedId(id)}
              onHover={(hover) =>
                setHoverBox(
                  hover
                    ? {
                        x: hover.x,
                        y: hover.y,
                        label: hover.node.label,
                        sub: `${hover.node.country} · avg score ${hover.node.averageScore} · ${formatCompactNumber(total(hover.node))} USD`,
                        link: `${hover.degree} ${hover.degree === 1 ? "connection" : "connections"} · click to open`,
                      }
                    : null,
                )
              }
            />
            {hoverBox ? (
              <div
                className="pointer-events-none absolute z-10 max-w-[280px] -translate-y-full rounded-tile border border-white/10 bg-[#0b1220]/95 px-3 py-2 text-[11.5px] shadow-lift backdrop-blur"
                style={{ left: hoverBox.x + 12, top: Math.max(44, hoverBox.y - 10) }}
              >
                <p className="font-medium text-white">{hoverBox.label}</p>
                <p className="num mt-0.5 text-white/55">{hoverBox.sub}</p>
                <p className="num mt-0.5 font-medium text-[#F0B250]">{hoverBox.link}</p>
              </div>
            ) : null}
          </div>

          {visible.nodes.length === 0 ? (
            <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col items-center justify-center gap-2 border-b border-white/[0.07] bg-transparent text-center">
              <p className="text-[13px] font-medium text-white">No entities match these filters</p>
              <p className="max-w-sm text-[11.5px] text-white/55">
                Widen the value or risk filter, or clear the search to see the rest of the network.
              </p>
            </div>
          ) : null}

          <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2 text-[11px] text-white/50">
            <span className="num">
              {visible.nodes.length} entities · {visible.edges.length} relationships
            </span>
            <span>Drag to orbit · scroll to zoom · double-click to reset the view</span>
          </div>
        </div>
      </div>

      <aside className="min-w-0 space-y-3">
        {selectedVisible ? (
          <NodeInspector
            selected={selectedVisible}
            edges={visible.edges}
            nodeById={nodeById}
            onSelect={(id) => setSelectedId(id)}
            onClear={() => setSelectedId(null)}
            onFocus={(id) => {
              setSelectedId(id);
              focusNeighbourhood(id);
            }}
          />
        ) : (
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3 className="panel-title">Select an entity</h3>
                <p className="panel-caption mt-1">Tap a bead to count its connections</p>
              </div>
              <Focus className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-[12px] leading-5 text-muted-foreground">
                Every bead is an entity; every curve is a real transfer in this window. Tap one to
                see how many entities it is connected to, what it paid and received, and who its
                strongest counterparty is.
              </p>
              <div>
                <p className="label-xs mb-2">Largest entities</p>
                <ul className="space-y-0.5">
                  {[...visible.nodes]
                    .sort((a, b) => total(b) - total(a))
                    .slice(0, 8)
                    .map((node) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(node.id)}
                          className="flex w-full items-center gap-2 rounded-tile px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full bg-[#EEF3FB] ring-2"
                            style={{
                              ["--tw-ring-color" as string]:
                                RISK_COLORS[
                                  node.averageScore >= 85
                                    ? "critical"
                                    : node.averageScore >= 70
                                      ? "high"
                                      : node.averageScore >= 40
                                        ? "medium"
                                        : "low"
                                ],
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px]">{node.label}</span>
                          <span className="num shrink-0 text-[11px] text-muted-foreground">
                            {formatCompactNumber(total(node))}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
