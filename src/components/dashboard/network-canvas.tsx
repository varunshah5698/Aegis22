"use client";

import * as React from "react";
import {
  DEFAULT_CAMERA,
  forceLayout,
  neighbourhood,
  project,
  type Camera,
  type ProjectedNode,
} from "@/lib/network/graph-model";
import { RISK_RGB, scoreToLevel } from "@/config/risk";
import type { NetworkEdge, NetworkNode } from "@/lib/data/network";

/**
 * Canvas relationship renderer.
 *
 * Replaces the Cytoscape instance, which mis-scaled its backing canvas: the
 * 2x device buffer was blitted with a 1x transform, so the graph painted into
 * the top-left quarter and every bead read as a faint smudge on the near-black
 * plate. This renderer owns its own device-pixel transform, paints light beads
 * with a risk-coloured rim, projects a real 3D cloud with perspective, and
 * hit-tests taps against the projected beads.
 */

export interface RenderHover {
  x: number;
  y: number;
  node: NetworkNode;
  degree: number;
}

interface Props {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId: string | null;
  hoverId: string | null;
  showLabels: boolean;
  camera: Camera;
  onSelect: (id: string | null) => void;
  onHover: (hover: RenderHover | null) => void;
  onZoom: (scale: number) => void;
  /** Called when the canvas settles on a size or layout, so the caller can fit. */
  onReady?: () => void;
  className?: string;
  /** Exposed for the fit/zoom buttons and for tests. */
  apiRef?: React.MutableRefObject<NetworkCanvasApi | null>;
}

export interface NetworkCanvasApi {
  fit: () => void;
  zoomBy: (factor: number) => void;
  projected: () => ProjectedNode[];
}

const LIGHT_BEAD = "#EEF3FB";
const LIGHT_BEAD_EDGE = "#FFFFFF";
const FAR_BEAD = "#A9B7CC";

export function NetworkCanvas({
  nodes,
  edges,
  selectedId,
  hoverId,
  showLabels,
  camera,
  onSelect,
  onHover,
  onZoom,
  onReady,
  className,
  apiRef,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const sizeRef = React.useRef({ width: 0, height: 0, dpr: 1 });
  const stateRef = React.useRef({
    camera,
    rotation: { yaw: 0, pitch: 0 },
    dragging: false,
    moved: false,
    last: { x: 0, y: 0 },
    hover: null as string | null,
    selectedId,
    hoverId,
    showLabels,
    projected: [] as ProjectedNode[],
    frame: 0,
  });

  const nodeById = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const maxValue = React.useMemo(
    () => Math.max(1, ...nodes.map((node) => node.inValue + node.outValue)),
    [nodes],
  );
  const points = React.useMemo(() => forceLayout(nodes, edges, maxValue), [nodes, edges, maxValue]);
  const degrees = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const node of nodes) map.set(node.id, neighbourhood(node.id, edges, nodeById).degree);
    return map;
  }, [nodes, edges, nodeById]);

  const state = stateRef.current;
  state.camera = camera;
  state.selectedId = selectedId;
  state.hoverId = hoverId;
  state.showLabels = showLabels;

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height, dpr } = sizeRef.current;
    if (width === 0 || height === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cam: Camera = {
      ...state.camera,
      yaw: camera.yaw + state.rotation.yaw,
      pitch: camera.pitch + state.rotation.pitch,
      scale: camera.scale,
      cx: width / 2,
      cy: height / 2,
    };
    const projected = project(points, nodes, maxValue, cam, { width, height });
    state.projected = projected;

    const byId = new Map(projected.map((item) => [item.node.id, item]));
    const focusId = state.hoverId ?? state.selectedId;
    const neighbours = new Set<string>();
    if (focusId) {
      for (const edge of edges) {
        if (edge.source === focusId) neighbours.add(edge.target);
        if (edge.target === focusId) neighbours.add(edge.source);
      }
    }

    // Edges first, dimmed by depth, highlighted when attached to the focus.
    for (const edge of edges) {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to) continue;
      const attached = focusId != null && (edge.source === focusId || edge.target === focusId);
      const level = scoreToLevel(edge.averageScore);
      const [r, g, b] = RISK_RGB[level];
      const depth = (from.depth + to.depth) / 2;
      const alpha = focusId ? (attached ? 0.85 : 0.05) : 0.16 + depth * 0.3;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = attached ? 1.5 + Math.min(2, Math.log2(1 + edge.value / 50_000)) : 0.8;
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      // Bow each curve so parallel transfers stay separable.
      const bow = Math.min(28, len * 0.12);
      const cx = mx - (dy / len) * bow;
      const cy = my + (dx / len) * bow;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cx, cy, to.x, to.y);
      ctx.stroke();

      if (attached && to.radius > 5) {
        // Arrowhead: direction of the final tangent.
        const tx = to.x - cx;
        const ty = to.y - cy;
        const tl = Math.hypot(tx, ty) || 1;
        const ux = tx / tl;
        const uy = ty / tl;
        const tip = to.radius + 2;
        const bx = to.x - ux * tip;
        const by = to.y - uy * tip;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - ux * 7 - uy * 3.6, by - uy * 7 + ux * 3.6);
        ctx.lineTo(bx - ux * 7 + uy * 3.6, by - uy * 7 - ux * 3.6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw far beads first so near ones occlude them, and only label the largest
    // 18 when nothing is selected. Front beads claim their labels before the
    // beads behind them.
    const ordered = [...projected].sort((a, b) => a.depth - b.depth);
    const labelFloor =
      [...projected].map((item) => item.value).sort((a, b) => b - a)[
        Math.min(17, projected.length - 1)
      ] ?? 0;
    const placedLabels: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    for (const item of ordered) {
      const level = scoreToLevel(item.node.averageScore);
      const [r, g, b] = RISK_RGB[level];
      const isFocus = item.node.id === focusId;
      const isNeighbour = focusId ? neighbours.has(item.node.id) : true;
      const dim = focusId ? !isFocus && !isNeighbour : false;
      const radius = Math.max(3, item.radius);
      const depthAlpha = 0.55 + item.depth * 0.45;
      const alpha = dim ? 0.12 : Math.min(1, depthAlpha + (isNeighbour && !isFocus ? 0.08 : 0));

      ctx.globalAlpha = alpha;

      // Halo ties the bead to its risk level without colouring the body.
      const glow = ctx.createRadialGradient(
        item.x,
        item.y,
        radius * 0.7,
        item.x,
        item.y,
        radius * 2.1,
      );
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${isFocus ? 0.42 : 0.22})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(item.x, item.y, radius * 2.1, 0, Math.PI * 2);
      ctx.fill();

      const face = ctx.createRadialGradient(
        item.x - radius * 0.35,
        item.y - radius * 0.45,
        radius * 0.15,
        item.x,
        item.y,
        radius * 1.05,
      );
      face.addColorStop(0, LIGHT_BEAD_EDGE);
      face.addColorStop(0.62, LIGHT_BEAD);
      face.addColorStop(1, FAR_BEAD);
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = isFocus ? 3.4 : item.node.pep ? 2.6 : 2;
      ctx.strokeStyle = isFocus ? "#FFFFFF" : `rgb(${r}, ${g}, ${b})`;
      if (item.node.nominee) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (item.node.flagged > 0 && !dim) {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(item.x + radius * 0.72, item.y - radius * 0.72, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Labels are the scarce resource: only the focused bead, its neighbours and
      // the largest beads get one, and any label that would collide with an
      // already-drawn label is dropped. Sixty stacked labels read as a smudge.
      const wantsLabel = state.showLabels && !dim && (!!focusId || item.value >= labelFloor);
      if (wantsLabel) {
        const label =
          item.node.label.length > 22 ? `${item.node.label.slice(0, 21)}…` : item.node.label;
        ctx.font = `${isFocus ? 600 : 500} ${isFocus ? 12 : 11}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const textWidth = ctx.measureText(label).width;
        const box = {
          left: item.x - textWidth / 2 - 2,
          right: item.x + textWidth / 2 + 2,
          top: item.y + radius + 4,
          bottom: item.y + radius + 18,
        };
        const collides = placedLabels.some(
          (other) =>
            box.left < other.right &&
            box.right > other.left &&
            box.top < other.bottom &&
            box.bottom > other.top,
        );
        if (isFocus || !collides) {
          placedLabels.push(box);
          ctx.globalAlpha = 0.45 + item.depth * 0.55;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(5, 8, 15, 0.85)";
          ctx.strokeText(label, item.x, item.y + radius + 5);
          ctx.fillStyle = isFocus ? "#FFFFFF" : "rgba(233, 239, 250, 0.86)";
          ctx.fillText(label, item.x, item.y + radius + 5);
        }
      }
    }
    ctx.globalAlpha = 1;
    // `state` is a stable ref whose camera/selection fields are refreshed on every
    // render above, so the frame it draws always matches the props just passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, maxValue, nodes, points]);

  const scheduleDraw = React.useCallback(() => {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      draw();
    });
  }, [draw, state]);

  // Size tracking keeps the device buffer and the CSS box in lockstep.
  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (
        width === sizeRef.current.width &&
        height === sizeRef.current.height &&
        dpr === sizeRef.current.dpr
      )
        return;
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      draw();
      onReady?.();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw, onReady]);

  React.useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, selectedId, hoverId, showLabels, camera, points]);

  const pick = (x: number, y: number): ProjectedNode | null => {
    let best: ProjectedNode | null = null;
    let bestDistance = Infinity;
    for (const item of state.projected) {
      const distance = Math.hypot(item.x - x, item.y - y);
      const hit = Math.max(item.radius + 6, 14);
      if (distance <= hit && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  };

  const local = (event: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    state.dragging = true;
    state.moved = false;
    state.last = local(event);
    // Capture keeps the drag alive outside the canvas. It throws when the pointer
    // is not active (synthetic events, some assistive tech), which must not stop
    // the tap, so a failed capture is not an error.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const position = local(event);
    if (state.dragging) {
      const dx = position.x - state.last.x;
      const dy = position.y - state.last.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) state.moved = true;
      state.last = position;
      state.rotation.yaw += dx * 0.006;
      state.rotation.pitch = Math.max(-1.1, Math.min(1.1, state.rotation.pitch + dy * 0.005));
      scheduleDraw();
      return;
    }
    const hit = pick(position.x, position.y);
    const nextHover = hit?.node.id ?? null;
    if (nextHover === state.hover) return;
    state.hover = nextHover;
    onHover(
      hit
        ? { x: position.x, y: position.y, node: hit.node, degree: degrees.get(hit.node.id) ?? 0 }
        : null,
    );
    draw();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDragging = state.dragging;
    state.dragging = false;
    if (!wasDragging) return;
    if (state.moved) return;
    const position = local(event);
    const hit = pick(position.x, position.y);
    onSelect(hit ? hit.node.id : null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    onZoom(factor);
  };

  React.useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      fit: () => {
        state.rotation = { yaw: 0, pitch: 0 };
        onZoom(1 / camera.scale);
      },
      zoomBy: (factor: number) => onZoom(factor),
      projected: () => state.projected,
    };
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef, camera.scale, onZoom, state]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        role="application"
        aria-label="Entity relationship cloud. Tap an entity to see how many it is connected to; drag to orbit, scroll to zoom."
        style={{ cursor: state.dragging ? "grabbing" : state.hover ? "pointer" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          state.hover = null;
          onHover(null);
          draw();
        }}
        onDoubleClick={() => {
          state.rotation = { yaw: 0, pitch: 0 };
          scheduleDraw();
        }}
        onWheel={handleWheel}
      />
    </div>
  );
}

export { DEFAULT_CAMERA };
