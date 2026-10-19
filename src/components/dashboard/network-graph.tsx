"use client";

import * as React from "react";
import Link from "next/link";
import cytoscape, {
  type Core,
  type EdgeSingular,
  type ElementDefinition,
  type LayoutOptions,
  type NodeSingular,
} from "cytoscape";
import {
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Grid2x2,
  Maximize2,
  Minus,
  Plus,
  Radar,
  Search,
  Share2,
  X,
} from "lucide-react";

import { RISK_COLORS, scoreToLevel, type RiskLevel } from "@/config/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NetworkEdge, NetworkNode } from "@/lib/data/network";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

type LayoutKind = "concentric" | "grid" | "cose";

const LAYOUTS: Array<{ id: LayoutKind; label: string; icon: typeof Radar; hint: string }> = [
  { id: "concentric", label: "Concentric", icon: Radar, hint: "Rings by exposure, highest in the middle" },
  { id: "grid", label: "Grid", icon: Grid2x2, hint: "Ordered square grid, easiest to scan" },
  { id: "cose", label: "Force", icon: Share2, hint: "Force-directed clusters of connected entities" },
];

const KIND_LABELS: Record<NetworkNode["kind"], string> = {
  individual: "Individual",
  company: "Company",
  intermediary: "Intermediary",
};

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

function total(node: NetworkNode): number {
  return node.inValue + node.outValue;
}

function shortName(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Interactive relationship explorer built on Cytoscape. Every element is a real
 * entity or a real transfer between entities: node size tracks screened value,
 * node colour tracks risk, and edges carry value and average score. Layouts are
 * computed by the graph engine (concentric rings, square grid, force-directed)
 * rather than hardcoded positions.
 */
export function NetworkGraph({ nodes, edges }: { nodes: NetworkNode[]; edges: NetworkEdge[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cyRef = React.useRef<Core | null>(null);
  const [layout, setLayout] = React.useState<LayoutKind>("concentric");
  const [showLabels, setShowLabels] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [riskMin, setRiskMin] = React.useState(0);
  const [valueMin, setValueMin] = React.useState(0);
  const [kind, setKind] = React.useState<"all" | NetworkNode["kind"]>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<{ x: number; y: number; node: NetworkNode } | null>(null);
  const [zoom, setZoom] = React.useState(1);

  const nodeById = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const maxValue = React.useMemo(() => Math.max(1, ...nodes.map(total)), [nodes]);

  /** Filtering happens before layout so the view never shows half-drawn state. */
  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const keptNodes = nodes.filter((node) => {
      if (node.averageScore < riskMin) return false;
      if (total(node) < valueMin) return false;
      if (kind !== "all" && node.kind !== kind) return false;
      if (needle && !`${node.label} ${node.country} ${node.kind}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const keptIds = new Set(keptNodes.map((node) => node.id));
    const keptEdges = edges
      .filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target))
      .filter((edge) => edge.value >= valueMin);
    return { nodes: keptNodes, edges: keptEdges };
  }, [nodes, edges, query, riskMin, valueMin, kind]);

  const connectedIds = React.useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const edge of visible.edges) {
      if (edge.source === selectedId) set.add(edge.target);
      if (edge.target === selectedId) set.add(edge.source);
    }
    return set;
  }, [selectedId, visible.edges]);

  /** Elements are rebuilt whenever the filter result changes. */
  const elements = React.useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = visible.nodes.map((node) => ({
      group: "nodes",
      data: {
        id: node.id,
        label: shortName(node.label),
        fullLabel: node.label,
        country: node.country,
        kind: node.kind,
        risk: node.averageScore,
        value: total(node),
        flagged: node.flagged,
        pep: node.pep,
        nominee: node.nominee,
        dim: selectedId ? !connectedIds.has(node.id) : false,
      },
    }));

    const edgeElements: ElementDefinition[] = visible.edges.map((edge) => ({
      group: "edges",
      data: {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        value: edge.value,
        score: edge.averageScore,
        count: edge.count,
        dim: selectedId ? edge.source !== selectedId && edge.target !== selectedId : false,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [visible, selectedId, connectedIds]);

  /* ------------------------------------------------------------------ init */

  React.useEffect(() => {
    if (!containerRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      wheelSensitivity: 0.2,
      minZoom: 0.2,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: NodeSingular) => RISK_COLORS[scoreToLevel(Number(ele.data("risk"))) as RiskLevel],
            width: (ele: NodeSingular) => 14 + Math.sqrt(Number(ele.data("value")) / maxValue) * 38,
            height: (ele: NodeSingular) => 14 + Math.sqrt(Number(ele.data("value")) / maxValue) * 38,
            label: "data(label)",
            // Cytoscape parses colours on the canvas and only accepts comma
            // separated rgb(), rgba() or hex — space separated CSS colours fall
            // back to black, which would hide labels on a dark graph.
            color: "#e7ecf3",
            "font-size": 11,
            "font-family": "ui-monospace, SFMono-Regular, monospace",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-outline-width": 2.5,
            "text-outline-color": "#07090d",
            "border-width": 0,
          },
        },
        {
          selector: "node[?pep]",
          style: { "border-width": 3, "border-color": "#F87171", "border-style": "solid" },
        },
        {
          selector: "node[?nominee]",
          style: { "border-width": 3, "border-color": "#A78BFA", "border-style": "solid" },
        },
        {
          selector: "node[dim]",
          style: { opacity: 0.22 },
        },
        {
          selector: "node:selected",
          style: { "border-width": 4, "border-color": "#bef264", "overlay-opacity": 0.08 },
        },
        {
          selector: "edge",
          style: {
            width: (ele: EdgeSingular) => 0.6 + Math.min(4, Math.log2(1 + Number(ele.data("value")) / 50_000)),
            "line-color": (ele: EdgeSingular) => RISK_COLORS[scoreToLevel(Number(ele.data("score"))) as RiskLevel],
            "target-arrow-color": (ele: EdgeSingular) => RISK_COLORS[scoreToLevel(Number(ele.data("score"))) as RiskLevel],
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.6,
            "curve-style": "bezier",
            opacity: 0.5,
          },
        },
        { selector: "edge[dim]", style: { opacity: 0.12 } },
        { selector: ".no-label", style: { label: "" } },
      ],
      layout: { name: "preset" },
    });

    cy.on("tap", "node", (event) => {
      const id = event.target.id() as string;
      setSelectedId(id);
    });
    cy.on("tap", (event) => {
      if (event.target === cy) setSelectedId(null);
    });
    cy.on("mouseover", "node", (event) => {
      const node = nodeById.get(event.target.id() as string);
      if (!node) return;
      const position = event.renderedPosition ?? { x: 0, y: 0 };
      setHover({ x: position.x, y: position.y, node });
      containerRef.current?.style.setProperty("cursor", "pointer");
    });
    cy.on("mouseout", "node", () => {
      setHover(null);
      containerRef.current?.style.setProperty("cursor", "grab");
    });
    // Labels are drawn in graph space, so their apparent size collapses as the
    // user zooms out. Scaling the font back up keeps entity names readable at
    // fit zoom without hiding the graph itself.
    let labelFrame = 0;
    cy.on("zoom", () => {
      setZoom(cy.zoom());
      if (labelFrame) return;
      labelFrame = window.requestAnimationFrame(() => {
        labelFrame = 0;
        const size = Math.min(15, Math.max(9.5, 10 / Math.max(0.4, cy.zoom())));
        cy.nodes().style("font-size", size);
      });
    });

    cyRef.current = cy;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __sfCy?: Core }).__sfCy = cy;
    }
    const observer = new ResizeObserver(() => cy.resize());
    observer.observe(containerRef.current);
    void reduced;

    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
    // The graph instance is created once; elements are synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------------- elements */

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
  }, [elements]);

  /* ---------------------------------------------------------------- layouts */

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const options: LayoutOptions =
      layout === "concentric"
        ? {
            name: "concentric",
            animate: !reduced,
            animationDuration: 420,
            padding: 46,
            minNodeSpacing: 26,
            // Values are normalised to 0-100 so the ring count stays readable and
            // the highest-exposure entity sits firmly in the middle.
            concentric: (node) => (Number(node.data("value")) / maxValue) * 100,
            levelWidth: () => 14,
            startAngle: -Math.PI / 2,
          }
        : layout === "grid"
          ? { name: "grid", animate: !reduced, animationDuration: 420, padding: 34, avoidOverlap: true, condense: false }
          : {
              name: "cose",
              animate: !reduced,
              animationDuration: 520,
              padding: 34,
              nodeRepulsion: () => 2600,
              idealEdgeLength: () => 58,
              edgeElasticity: () => 60,
              gravity: 1.6,
              componentSpacing: 60,
              nodeOverlap: 6,
              numIter: 500,
              randomize: false,
              // Keep the simulation inside the visible canvas so the force layout
              // never drifts into a region the user has to hunt for.
              boundingBox: {
                x1: 16,
                y1: 16,
                x2: Math.max(360, cy.width() - 16),
                y2: Math.max(280, cy.height() - 16),
              },
            };

    const instance = cy.layout(options);
    instance.one("layoutstop", () => {
      cy.resize();
      cy.fit(undefined, 44);
    });
    instance.run();
  }, [layout, elements.length, maxValue]);

  /* -------------------------------------------------------------- selection */

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedId && cy.getElementById(selectedId).nonempty()) {
      cy.getElementById(selectedId).select();
    }
  }, [selectedId, elements]);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (showLabels) cy.elements().removeClass("no-label");
    else cy.elements().addClass("no-label");
  }, [showLabels, elements]);

  /* ------------------------------------------------------------------ panel */

  const selected = selectedId ? (nodeById.get(selectedId) ?? null) : null;

  const counterparties = React.useMemo(() => {
    if (!selected) return [];
    const rows: Array<{ node: NetworkNode; value: number; count: number; score: number; direction: "in" | "out" }> = [];
    for (const edge of edges) {
      if (edge.source === selected.id) {
        const node = nodeById.get(edge.target);
        if (node) rows.push({ node, value: edge.value, count: edge.count, score: edge.averageScore, direction: "out" });
      } else if (edge.target === selected.id) {
        const node = nodeById.get(edge.source);
        if (node) rows.push({ node, value: edge.value, count: edge.count, score: edge.averageScore, direction: "in" });
      }
    }
    return rows.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [selected, edges, nodeById]);

  const leaders = React.useMemo(
    () => [...nodes].sort((a, b) => total(b) - total(a)).slice(0, 5),
    [nodes],
  );

  const focusNeighbourhood = () => {
    const cy = cyRef.current;
    if (!cy || !selectedId) return;
    const collection = cy.getElementById(selectedId).closedNeighborhood();
    cy.animate({ fit: { eles: collection, padding: 90 } }, { duration: 380 });
  };

  const legendLevels: RiskLevel[] = ["low", "medium", "high", "critical"];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        {/* Controls ------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-tile border border-border bg-muted/40 p-0.5" role="group" aria-label="Layout">
            {LAYOUTS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                aria-pressed={layout === option.id}
                onClick={() => setLayout(option.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                  layout === option.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="size-3.5" aria-hidden="true" />
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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

          <div className="flex items-center rounded-tile border border-border p-0.5" role="group" aria-label="Risk filter">
            {RISK_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={riskMin === option.min}
                onClick={() => setRiskMin(option.min)}
                className={cn(
                  "num rounded-[8px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                  riskMin === option.min ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas --------------------------------------------------------- */}
        <div className="relative overflow-hidden rounded-panel border border-border bg-[rgb(var(--background))]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {legendLevels.map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: RISK_COLORS[level] }} aria-hidden="true" />
                  {level}
                </span>
              ))}
              <span className="text-[10.5px] text-muted-foreground">size = value · line = transfer direction</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px]"
                onClick={() => setShowLabels((value) => !value)}
              >
                {showLabels ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                {showLabels ? "Hide labels" : "Show labels"}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Zoom out" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.25)}>
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="num w-10 text-center text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Zoom in" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}>
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Fit graph" onClick={() => cyRef.current?.fit(undefined, 40)}>
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="h-[560px] w-full"
            role="application"
            aria-label="Entity relationship graph. Use the entity list in the side panel for a keyboard-accessible view."
          />

          {hover ? (
            <div
              className="pointer-events-none absolute z-10 max-w-[260px] rounded-tile border border-border bg-card/95 px-3 py-2 text-[11.5px] shadow-lift backdrop-blur"
              style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}
            >
              <p className="font-medium text-foreground">{hover.node.label}</p>
              <p className="num mt-0.5 text-muted-foreground">
                {hover.node.country} · {KIND_LABELS[hover.node.kind]} · avg score {hover.node.averageScore}
              </p>
              <p className="num text-muted-foreground">
                {formatCompactNumber(total(hover.node))} USD · {hover.node.inCount + hover.node.outCount} transfers
              </p>
            </div>
          ) : null}

          {visible.nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-center">
              <p className="text-[13px] font-medium">No entities match these filters</p>
              <p className="max-w-sm text-[11.5px] text-muted-foreground">
                Widen the value or risk filter, or clear the search to see the rest of the network.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="num">
              {visible.nodes.length} entities · {visible.edges.length} relationships
            </span>
            <span>
              {layout === "concentric"
                ? "Rings by screened value, highest in the middle"
                : layout === "grid"
                  ? "Ordered grid, easiest for scanning many entities"
                  : "Force layout, connected entities pull together"}
            </span>
          </div>
        </div>
      </div>

      {/* Inspector ------------------------------------------------------- */}
      <aside className="min-w-0 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">{selected ? "Entity profile" : "Select an entity"}</h3>
              <p className="panel-caption mt-1">
                {selected ? "Every figure below comes from the selected payment window" : "Click a node to inspect its flows"}
              </p>
            </div>
            {selected ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Clear selection"
                onClick={() => setSelectedId(null)}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          {selected ? (
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="text-[14px] font-semibold leading-5">{selected.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <span className="num">{selected.country}</span>·<span>{KIND_LABELS[selected.kind]}</span>·
                  <span className="num">
                    {selected.accountCount} {selected.accountCount === 1 ? "account" : "accounts"}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className="chip"
                    style={{ borderColor: `${RISK_COLORS[scoreToLevel(selected.averageScore)]}55` }}
                  >
                    avg score <span className="num">{selected.averageScore}</span>
                  </span>
                  {selected.pep ? <span className="chip border-risk-critical/40 text-risk-critical">PEP</span> : null}
                  {selected.nominee ? <span className="chip border-chart-3/40 text-chart-3">Nominee director</span> : null}
                  {selected.flagged > 0 ? (
                    <span className="chip border-risk-high/40 text-risk-high">
                      <span className="num">{selected.flagged}</span> flagged flows
                    </span>
                  ) : null}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "Sent out",
                    value: formatCompactNumber(selected.outValue),
                    hint: `${selected.outCount} ${selected.outCount === 1 ? "transfer" : "transfers"}`,
                  },
                  {
                    label: "Received",
                    value: formatCompactNumber(selected.inValue),
                    hint: `${selected.inCount} ${selected.inCount === 1 ? "transfer" : "transfers"}`,
                  },
                  {
                    label: "Pass-through",
                    value: selected.inValue > 0 ? `${Math.round((selected.outValue / selected.inValue) * 100)}%` : "—",
                    hint: "outbound vs inbound value",
                  },
                  { label: "Screened", value: formatCompactNumber(total(selected)), hint: "USD base value" },
                ].map((item) => (
                  <div key={item.label} className="rounded-tile border border-border/70 bg-elevated/50 px-2.5 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{item.label}</dt>
                    <dd className="num mt-1 text-[15px] font-medium leading-5">{item.value}</dd>
                    <dd className="num text-[10.5px] text-muted-foreground">{item.hint}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]" onClick={focusNeighbourhood}>
                  <Focus className="size-3.5" aria-hidden="true" /> Focus neighbourhood
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]">
                  <Link href={`/app/transactions?q=${encodeURIComponent(selected.label)}`}>
                    <Crosshair className="size-3.5" aria-hidden="true" /> Transactions
                  </Link>
                </Button>
              </div>

              <div>
                <p className="label-xs mb-2">Counterparties</p>
                <ul className="space-y-1.5">
                  {counterparties.length === 0 ? (
                    <li className="text-[11.5px] text-muted-foreground">No connections in this window.</li>
                  ) : (
                    counterparties.map((row) => (
                      <li key={`${row.direction}-${row.node.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.node.id)}
                          className="flex w-full items-center gap-2 rounded-tile px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                        >
                          <span
                            className={cn(
                              "num w-8 shrink-0 rounded-[5px] px-1 py-0.5 text-center text-[10px]",
                              row.direction === "out" ? "bg-chart-2/15 text-chart-2" : "bg-chart-4/15 text-chart-4",
                            )}
                          >
                            {row.direction === "out" ? "OUT" : "IN"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px]">{row.node.label}</span>
                            <span className="num block text-[10.5px] text-muted-foreground">
                              {formatCurrency(row.value, "USD", { compact: true })} · {row.count}{" "}
                              {row.count === 1 ? "transfer" : "transfers"} · avg {row.score}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4">
              <p className="text-[12px] leading-5 text-muted-foreground">
                Drag nodes to rearrange, scroll to zoom and select any entity to trace its counterparties. The three
                layouts recompute from the relationship data.
              </p>
              <div>
                <p className="label-xs mb-2">Largest entities</p>
                <ul className="space-y-1">
                  {leaders.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(node.id)}
                        className="flex w-full items-center gap-2 rounded-tile px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: RISK_COLORS[scoreToLevel(node.averageScore)] }}
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
          )}
        </div>
      </aside>
    </div>
  );
}
