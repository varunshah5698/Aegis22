"use client";

import * as React from "react";
import Link from "next/link";
import cytoscape, {
  type Core,
  type EdgeSingular,
  type ElementDefinition,
  type NodeSingular,
} from "cytoscape";
import {
  ArrowUpRight,
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

import { RISK_COLORS, riskGlow, scoreToLevel, type RiskLevel } from "@/config/risk";
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
 * Deterministic point cloud inside a unit square. A sunflower spiral spreads
 * points evenly, so the relaxation below resolves overlaps in a predictable
 * number of passes regardless of the entity count.
 */
function seedPositions(count: number): Array<{ x: number; y: number }> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const radius = Math.sqrt((index + 0.5) / Math.max(1, count)) * 0.46;
    const angle = index * golden;
    return { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
  });
}

/**
 * Circle packing by iterative separation. Cytoscape ships no collision
 * extension out of the box, so labels collide and nodes hide behind one
 * another at fit zoom; a few pairwise passes on unit space fixes both without
 * a new dependency or a runtime that reshuffles the graph on every pan.
 */
function packPositions(
  offsets: Array<{ x: number; y: number }>,
  radii: number[],
): Array<{ x: number; y: number }> {
  const points = offsets.map((point) => ({ ...point }));
  const n = points.length;
  const spread = 0.62 / Math.max(0.02, Math.max(...radii));

  for (let pass = 0; pass < 160; pass += 1) {
    let moved = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = points[i]!;
        const b = points[j]!;
        let dx = (b.x - a.x) * spread;
        let dy = (b.y - a.y) * spread;
        let distance = Math.hypot(dx, dy);
        if (distance === 0) {
          dx = 0.0001 * (i + 1);
          dy = 0.0001 * (j + 1);
          distance = Math.hypot(dx, dy);
        }
        const minimum = radii[i]! + radii[j]! + 0.012;
        if (distance >= minimum) continue;
        const push = ((minimum - distance) / distance) * 0.5;
        a.x -= (dx / spread) * push;
        a.y -= (dy / spread) * push;
        b.x += (dx / spread) * push;
        b.y += (dy / spread) * push;
        moved = Math.max(moved, minimum - distance);
      }
    }
    // Gentle pull toward the middle keeps the field a disc instead of letting
    // the outer ring drift away from the canvas centre.
    for (const point of points) {
      point.x += (0.5 - point.x) * 0.012;
      point.y += (0.5 - point.y) * 0.012;
    }
    if (moved < 0.0008) break;
  }

  return points;
}

/** Node radius in layout units: the same formula the renderer uses. */
function nodeRadius(value: number, maxValue: number): number {
  return 9 + Math.sqrt(Math.min(1, value / maxValue)) * 22;
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
            // A bead: dark body, coloured core, lighter rim and a soft halo, so
            // each entity reads as a solid object on the near-black canvas
            // instead of a flat pastel circle.
            "background-color": "#0D1422",
            "background-opacity": 1,
            "border-color": (ele: NodeSingular) => riskGlow(scoreToLevel(Number(ele.data("risk"))), 0.92),
            "border-width": 1.6,
            width: (ele: NodeSingular) => nodeRadius(Number(ele.data("value")), maxValue) * 2,
            height: (ele: NodeSingular) => nodeRadius(Number(ele.data("value")), maxValue) * 2,
            "background-image": "linear-gradient(150deg, rgba(255,255,255,0.20), rgba(255,255,255,0.02) 46%, rgba(0,0,0,0.42))",
            "underlay-color": (ele: NodeSingular) => riskGlow(scoreToLevel(Number(ele.data("risk"))), 0.16),
            "underlay-padding": (ele: NodeSingular) => Math.max(7, nodeRadius(Number(ele.data("value")), maxValue) * 0.45),
            "underlay-opacity": 1,
            "underlay-shape": "ellipse",
            label: "data(label)",
            // Cytoscape parses colours on the canvas and only accepts comma
            // separated rgb(), rgba() or hex — space separated CSS colours fall
            // back to black, which would hide labels on a dark graph.
            color: "#DCE4F0",
            "font-size": 10.5,
            "font-family": "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 5,
            "text-wrap": "ellipsis",
            "text-max-width": "108px",
            "text-outline-width": 3,
            "text-outline-color": "#05080f",
            "text-outline-opacity": 0.9,
            "transition-property": "border-width, border-color, underlay-opacity, underlay-padding",
            "transition-duration": 140,
          },
        },
        {
          selector: "node.hovered",
          style: {
            "border-width": 2.6,
            "underlay-opacity": 0.85,
            "underlay-color": (ele: NodeSingular) => riskGlow(scoreToLevel(Number(ele.data("risk"))), 0.32),
          },
        },
        {
          selector: "node[?pep]",
          style: { "border-width": 2.4, "border-style": "double", "border-color": "#F87171" },
        },
        {
          selector: "node[?nominee]",
          style: { "border-style": "dashed", "border-color": "#A78BFA" },
        },
        {
          selector: "node[dim]",
          style: { opacity: 0.16, "underlay-opacity": 0 },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#E8EEF9",
            "underlay-color": "rgba(232, 238, 249, 0.22)",
            "underlay-opacity": 1,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "edge",
          style: {
            width: (ele: EdgeSingular) => 0.8 + Math.min(3.2, Math.log2(1 + Number(ele.data("value")) / 50_000)),
            "line-color": (ele: EdgeSingular) => riskGlow(scoreToLevel(Number(ele.data("score"))), 0.5),
            "target-arrow-color": (ele: EdgeSingular) => riskGlow(scoreToLevel(Number(ele.data("score"))), 0.7),
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.55,
            "curve-style": "bezier",
            "control-point-step-size": 34,
            opacity: 0.55,
          },
        },
        {
          selector: "edge.hot",
          style: { opacity: 0.95, width: (ele: EdgeSingular) => 1.6 + Math.min(3.4, Math.log2(1 + Number(ele.data("value")) / 50_000)) },
        },
        { selector: "edge[dim]", style: { opacity: 0.08 } },
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
      event.target.addClass("hovered");
      event.target.connectedEdges().addClass("hot");
      const position = event.renderedPosition ?? { x: 0, y: 0 };
      setHover({ x: position.x, y: position.y, node });
      containerRef.current?.style.setProperty("cursor", "pointer");
    });
    cy.on("mouseout", "node", (event) => {
      event.target.removeClass("hovered");
      event.target.connectedEdges().removeClass("hot");
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
    const animate = !reduced;

    if (layout === "grid") {
      const instance = cy.layout({ name: "grid", animate, animationDuration: 420, padding: 34, avoidOverlap: true });
      instance.one("layoutstop", () => cy.fit(undefined, 40));
      instance.run();
      return;
    }

    if (layout === "concentric") {
      const instance = cy.layout({
        name: "concentric",
        animate,
        animationDuration: 420,
        padding: 46,
        minNodeSpacing: 28,
        // Values are normalised to 0-100 so the ring count stays readable and
        // the highest-exposure entity sits firmly in the middle.
        concentric: (node) => (Number(node.data("value")) / maxValue) * 100,
        levelWidth: () => 14,
        startAngle: -Math.PI / 2,
      });
      instance.one("layoutstop", () => {
        cy.resize();
        cy.fit(undefined, 44);
      });
      instance.run();
      return;
    }

    /*
     * Force layout.
     *
     * `cose` runs inside cytoscape's engine, which has no collision handling,
     * so beads overlap and labels stack on top of each other. Instead: a
     * deterministic repulsion/attraction pass pulled toward counterparties,
     * then a packing pass that guarantees a minimum gap between every pair.
     * The centroid then dictates radius and angle, which gives the concentric
     * look of connected entities without the overlap.
     */
    const visibleNodes = visible.nodes;
    const indices = new Map(visibleNodes.map((node, index) => [node.id, index]));
    const radii = visibleNodes.map((node) => nodeRadius(total(node), maxValue));
    const points = seedPositions(visibleNodes.length);
    const adjacency = visibleNodes.map(() => [] as number[]);
    for (const edge of visible.edges) {
      const from = indices.get(edge.source);
      const to = indices.get(edge.target);
      if (from === undefined || to === undefined || from === to) continue;
      adjacency[from]!.push(to);
      adjacency[to]!.push(from);
    }

    const pull = 0.06;
    const repel = 0.05;
    for (let iteration = 0; iteration < 220; iteration += 1) {
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          dx /= distance;
          dy /= distance;
          const force = (repel * 0.004) / (distance * distance);
          a.x -= dx * force;
          a.y -= dy * force;
          b.x += dx * force;
          b.y += dy * force;
        }
      }
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        for (const j of adjacency[i]!) {
          if (j <= i) continue;
          const b = points[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const force = (distance - 0.14) * pull * 0.02;
          a.x += (dx / distance) * force;
          a.y += (dy / distance) * force;
          b.x -= (dx / distance) * force;
          b.y -= (dy / distance) * force;
        }
      }
    }

    const packed = packPositions(points, radii);
    let sumX = 0;
    let sumY = 0;
    for (const point of packed) {
      sumX += point.x;
      sumY += point.y;
    }
    const centroid = { x: sumX / packed.length, y: sumY / packed.length };

    const width = Math.max(420, cy.width());
    const height = Math.max(320, cy.height());
    const scale = Math.min(width, height) * 0.86;
    cy.batch(() => {
      visibleNodes.forEach((node, index) => {
        const point = packed[index]!;
        const ele = cy.getElementById(node.id);
        if (ele.empty()) return;
        // Spread outward from the centroid so connected groups fan out instead
        // of collapsing into the middle of the canvas.
        const x = (point.x - centroid.x) * scale * 1.1 + width / 2;
        const y = (point.y - centroid.y) * scale * 1.1 + height / 2;
        ele.position({ x, y });
      });
    });
    cy.resize();
    cy.fit(undefined, 48);
  }, [layout, elements.length, maxValue, visible]);

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
        <div className="relative overflow-hidden rounded-panel border border-border bg-[#05080f]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 45%, rgba(96,165,250,0.10) 0%, transparent 70%), radial-gradient(40% 40% at 12% 100%, rgba(240,178,80,0.06) 0%, transparent 70%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {legendLevels.map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5 text-[10.5px] text-white/55">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      background: RISK_COLORS[level],
                      boxShadow: `0 0 0 3px ${riskGlow(level, 0.16)}`,
                    }}
                    aria-hidden="true"
                  />
                  {level}
                </span>
              ))}
              <span className="text-[10.5px] text-white/40">bead size = screened value · halo = risk level</span>
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
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.25)}>
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="num w-10 text-center text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}>
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Fit graph" onClick={() => cyRef.current?.fit(undefined, 40)}>
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

          <div className="relative mt-px flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2 text-[11px] text-white/45">
            <span className="num">
              {visible.nodes.length} entities · {visible.edges.length} relationships
            </span>
            <span>
              {layout === "concentric"
                ? "Rings by screened value, highest in the middle"
                : layout === "grid"
                  ? "Ordered grid, easiest for scanning many entities"
                  : "Connected entities cluster, every bead keeps its own space"}
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
                size="icon-sm"
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
                <Button asChild size="sm" className="h-8 gap-1.5 text-[11.5px]">
                  <Link href={`/app/network/${selected.id}`}>
                    Full profile <ArrowUpRight className="size-3.5" aria-hidden="true" />
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
