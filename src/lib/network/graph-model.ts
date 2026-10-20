/**
 * Geometry and relationship model behind the entity network canvas.
 *
 * Nothing in here touches the DOM, so the same code runs in the component, in
 * node for layout tuning, and in the unit tests. Three pieces:
 *
 * - a deterministic force layout in layout space (x, y, z), seeded on a
 *   golden-spiral sphere so the same data always produces the same picture;
 * - a painter's projection of that space into screen coordinates, with a soft
 *   depth cue for far beads;
 * - the neighbour/degree model a tap on a bead needs (degree, in/out value,
 *   link score) so the panel never has to re-derive it.
 */

import type { NetworkEdge, NetworkNode } from "@/lib/data/network";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedNode {
  node: NetworkNode;
  /** Layout-space position. */
  at: Point3;
  /** Screen position in CSS pixels. */
  x: number;
  y: number;
  /** Drawn radius in CSS pixels. */
  radius: number;
  /** 0 (far) to 1 (near). Drives opacity and label weight. */
  depth: number;
  value: number;
}

export const LAYOUT_SCALE = 1000;

/** Node radius in layout units from its screened value. */
export function nodeRadius(value: number, maxValue: number): number {
  return 9 + Math.sqrt(Math.min(1, value / Math.max(1, maxValue))) * 22;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(ids: string[]): number {
  let hash = 2166136261;
  for (const id of ids) {
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0x9e3779b9;
  }
  return hash >>> 0;
}

export interface ForceOptions {
  iterations?: number;
  repulsion?: number;
  linkage?: number;
  gravity?: number;
  /** Minimum gap kept between bead surfaces, in layout units. */
  gap?: number;
}

/**
 * Relaxes a seeded sphere into a balanced cloud.
 *
 * Repulsion keeps clusters apart, edges pull counterparties in, a weak pull to
 * the origin stops islands drifting, and a final separation pass guarantees no
 * two beads overlap (a force model alone always leaves a few coincident
 * points, which is what makes labels stack on each other).
 */
export function forceLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  maxValue: number,
  options: ForceOptions = {},
): Point3[] {
  const {
    iterations = 260,
    repulsion = 0.75,
    linkage = 0.045,
    gravity = 0.008,
    gap = 14,
  } = options;
  const count = nodes.length;
  if (count === 0) return [];

  const random = mulberry32(hashSeed(nodes.map((node) => node.id)));
  const positions: Point3[] = new Array(count);
  const radii: number[] = new Array(count);
  const mass: number[] = new Array(count);
  const indices = new Map<string, number>();

  const golden = Math.PI * (3 - Math.sqrt(5));
  nodes.forEach((node, index) => {
    indices.set(node.id, index);
    // Sunflower sphere: even coverage with no seam and no random clumping.
    const y = 1 - ((index + 0.5) / count) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    const jitter = 0.9 + random() * 0.2;
    const radius = LAYOUT_SCALE * 0.5 * jitter;
    positions[index] = {
      x: Math.cos(theta) * ring * radius,
      y: y * radius,
      z: Math.sin(theta) * ring * radius,
    };
    radii[index] = nodeRadius(node.inValue + node.outValue, maxValue);
    mass[index] = 1 + Math.sqrt(Math.max(1, node.degree));
  });

  const links: Array<[number, number, number]> = [];
  for (const edge of edges) {
    const from = indices.get(edge.source);
    const to = indices.get(edge.target);
    if (from === undefined || to === undefined || from === to) continue;
    const ideal = 150 + radii[from]! + radii[to]!;
    links.push([from, to, ideal]);
  }

  const force = new Float64Array(count * 3);
  const cooling = 0.92;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    force.fill(0);

    for (let i = 0; i < count; i += 1) {
      const a = positions[i]!;
      for (let j = i + 1; j < count; j += 1) {
        const b = positions[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        const distanceSq = dx * dx + dy * dy + dz * dz + 1;
        const distance = Math.sqrt(distanceSq);
        const magnitude = (repulsion * 3800 * Math.max(mass[i]!, mass[j]!)) / distanceSq;
        dx /= distance;
        dy /= distance;
        dz /= distance;
        force[i * 3] = force[i * 3]! - dx * magnitude;
        force[i * 3 + 1] = force[i * 3 + 1]! - dy * magnitude;
        force[i * 3 + 2] = force[i * 3 + 2]! - dz * magnitude;
        force[j * 3] = force[j * 3]! + dx * magnitude;
        force[j * 3 + 1] = force[j * 3 + 1]! + dy * magnitude;
        force[j * 3 + 2] = force[j * 3 + 2]! + dz * magnitude;
      }
    }

    for (const [from, to, ideal] of links) {
      const a = positions[from]!;
      const b = positions[to]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dy, dz) || 1;
      const magnitude = (distance - ideal) * linkage;
      const ux = (dx / distance) * magnitude;
      const uy = (dy / distance) * magnitude;
      const uz = (dz / distance) * magnitude;
      force[from * 3] = force[from * 3]! + ux;
      force[from * 3 + 1] = force[from * 3 + 1]! + uy;
      force[from * 3 + 2] = force[from * 3 + 2]! + uz;
      force[to * 3] = force[to * 3]! - ux;
      force[to * 3 + 1] = force[to * 3 + 1]! - uy;
      force[to * 3 + 2] = force[to * 3 + 2]! - uz;
    }

    const step = Math.pow(cooling, iteration / 26);
    for (let i = 0; i < count; i += 1) {
      const point = positions[i]!;
      point.x += (force[i * 3]! - point.x * gravity) * step;
      point.y += (force[i * 3 + 1]! - point.y * gravity) * step;
      point.z += (force[i * 3 + 2]! - point.z * gravity) * step;
    }
  }

  // Separation: push every overlapping pair apart so labels always have room.
  for (let pass = 0; pass < 40; pass += 1) {
    let moved = 0;
    for (let i = 0; i < count; i += 1) {
      const a = positions[i]!;
      for (let j = i + 1; j < count; j += 1) {
        const b = positions[j]!;
        const minimum = radii[i]! + radii[j]! + gap;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        let distance = Math.hypot(dx, dy, dz);
        if (distance >= minimum) continue;
        if (distance < 0.001) {
          dx = random() - 0.5;
          dy = random() - 0.5;
          dz = random() - 0.5;
          distance = Math.hypot(dx, dy, dz) || 1;
        }
        const push = (minimum - distance) / distance / 2;
        a.x -= dx * push;
        a.y -= dy * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.y += dy * push;
        b.z += dz * push;
        moved = Math.max(moved, minimum - distance);
      }
    }
    if (moved < 0.4) break;
  }

  return positions;
}

/** Bounding radius of a settled cloud, used to frame the camera. */
export function cloudExtent(points: Point3[]): number {
  let extent = 1;
  for (const point of points) extent = Math.max(extent, Math.hypot(point.x, point.y, point.z));
  return extent;
}

/**
 * Beads reach `radius` beyond their centre, and the projection can lean a bead
 * outward, so the envelope the camera must fit is larger than the raw cloud.
 */
export function cloudEnvelope(points: Point3[], radii: number[]): number {
  let envelope = 1;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    envelope = Math.max(envelope, Math.hypot(point.x, point.y, point.z) + (radii[index] ?? 0));
  }
  return envelope;
}

export interface Camera {
  /** Yaw in radians, rotating about the vertical axis. */
  yaw: number;
  /** Pitch in radians, tilting the cloud toward the viewer. */
  pitch: number;
  /** Perspensity of the projection. Larger is flatter. */
  distance: number;
  /** Pixels per layout unit. */
  scale: number;
  /** Screen centre. */
  cx: number;
  cy: number;
  /** Global opacity multiplier for the depth cue. */
  fade: number;
}

export const DEFAULT_CAMERA: Camera = {
  yaw: -0.35,
  pitch: 0.28,
  distance: 2.4,
  scale: 1,
  cx: 0,
  cy: 0,
  fade: 1,
};

/**
 * Perspective projection with a soft depth cue.
 *
 * The previous renderer drew every bead at the same weight, so a sphere read as
 * a flat mat of circles. Perspective plus a depth-dependent opacity and rim
 * gives the cloud front and back, which is what makes the structure legible.
 */
export function project(
  points: Point3[],
  nodes: NetworkNode[],
  maxValue: number,
  camera: Camera,
  /** Bleed factor: beads may sit slightly outside the box while staying readable. */
  bounds: { width: number; height: number },
): ProjectedNode[] {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const radii = nodes.map((node) => nodeRadius(node.inValue + node.outValue, maxValue));
  const envelope = cloudEnvelope(points, radii) || 1;
  // The camera sits a few envelopes in front of the origin and looks at it, so
  // near beads are noticeably larger and brighter than far ones — the depth cue
  // that turns a mat of circles into a cloud.
  const focus = envelope * camera.distance;
  const zoom = (Math.min(bounds.width, bounds.height) * 0.5 * camera.scale) / envelope;

  return nodes.map((node, index) => {
    const at = points[index] ?? { x: 0, y: 0, z: 0 };
    // Yaw about Y, then pitch about X.
    const x1 = at.x * cosYaw - at.z * sinYaw;
    const z1 = at.x * sinYaw + at.z * cosYaw;
    const y2 = at.y * cosPitch - z1 * sinPitch;
    const z2 = at.y * sinPitch + z1 * cosPitch;

    // z2 points away from the viewer along the view axis; divide by the depth
    // to the bead so nearer beads project wider.
    const perspective = focus / Math.max(focus * 0.25, focus + z2);
    const x = camera.cx + x1 * zoom * perspective;
    const y = camera.cy - y2 * zoom * perspective;
    const radius = (radii[index] ?? 8) * zoom * perspective;
    // Nearer (smaller z2) is brighter.
    const depth = Math.min(1, Math.max(0, 0.5 - (z2 / envelope) * 0.5));
    return {
      node,
      at,
      x,
      y,
      radius: Math.max(2.5, radius),
      depth,
      value: node.inValue + node.outValue,
    };
  });
}

/* ------------------------------------------------------ relationship model */

export interface LinkRow {
  node: NetworkNode;
  out: number;
  in: number;
  count: number;
  score: number;
  flagged: number;
}

export interface Neighbourhood {
  /** Unique counterparties, highest combined value first. */
  links: LinkRow[];
  /** Entities touched on either side. Same as links.length. */
  degree: number;
  outDegree: number;
  inDegree: number;
  /** Weakly connected component the entity belongs to, as ids. */
  component: Set<string>;
  outValue: number;
  inValue: number;
  outCount: number;
  inCount: number;
  flagged: number;
  averageScore: number;
}

export function neighbourhood(
  id: string,
  edges: NetworkEdge[],
  nodeById: Map<string, NetworkNode>,
): Neighbourhood {
  const rows = new Map<string, LinkRow>();
  let outValue = 0;
  let inValue = 0;
  let outCount = 0;
  let inCount = 0;
  let flagged = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adjacency.get(a);
    if (list) list.push(b);
    else adjacency.set(a, [b]);
  };

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    link(edge.source, edge.target);
    link(edge.target, edge.source);
    const outgoing = edge.source === id;
    const incoming = edge.target === id;
    if (!outgoing && !incoming) continue;

    const otherId = outgoing ? edge.target : edge.source;
    const node = nodeById.get(otherId);
    if (!node) continue;
    const row = rows.get(otherId) ?? { node, out: 0, in: 0, count: 0, score: 0, flagged: 0 };
    if (outgoing) {
      row.out += edge.value;
      outValue += edge.value;
      outCount += edge.count;
    } else {
      row.in += edge.value;
      inValue += edge.value;
      inCount += edge.count;
    }
    row.count += edge.count;
    row.flagged += edge.flagged;
    row.score = Math.max(row.score, edge.averageScore);
    rows.set(otherId, row);
    flagged += edge.flagged;
    scoreSum += edge.averageScore;
    scoreCount += 1;
  }

  const component = new Set<string>(adjacency.has(id) ? [id] : []);
  if (component.size > 0) {
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const next of adjacency.get(current) ?? []) {
        if (component.has(next)) continue;
        component.add(next);
        stack.push(next);
      }
    }
  }

  const links = [...rows.values()].sort((a, b) => b.out + b.in - (a.out + a.in));
  return {
    links,
    degree: links.length,
    outDegree: links.filter((row) => row.out > 0).length,
    inDegree: links.filter((row) => row.in > 0).length,
    component,
    outValue,
    inValue,
    outCount,
    inCount,
    flagged,
    averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
  };
}

/** How much of the graph sits within `hops` of the selected entity. */
export function reachAt(
  neighbourhoods: Map<string, Set<string>>,
  start: string,
  hops: number,
): Set<string> {
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let hop = 0; hop < hops; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of neighbourhoods.get(id) ?? []) {
        if (seen.has(other)) continue;
        seen.add(other);
        next.push(other);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return seen;
}

/** Adjacency map of one id to its direct counterparties. */
export function adjacencyMap(edges: NetworkEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    const set = map.get(a);
    if (set) set.add(b);
    else map.set(a, new Set([b]));
  };
  for (const edge of edges) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }
  return map;
}
