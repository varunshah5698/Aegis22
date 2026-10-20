/**
 * Deterministic 3D force layout for the entity network.
 *
 * Plain arithmetic with no DOM dependency, so it runs on the main thread for
 * the graph sizes the workspace produces and can be tested directly. Nodes are
 * seeded on a golden-spiral sphere (same data always produces the same picture)
 * and relaxed by three forces:
 *
 * - charge: every node repels every other node, which keeps clusters apart;
 * - spring: an edge pulls its two ends toward an ideal length scaled by value;
 * - gravity: a weak pull to the origin stops disconnected parts drifting away.
 *
 * Positions are written into a flat Float32Array (x, y, z per node), which is
 * the same buffer the renderer uploads, so a settled layout never has to be
 * copied into objects.
 */

export interface LayoutNodeInput {
  id: string;
  /** Importance (screened value). Drives mass and repulsion. */
  weight: number;
}

export interface LayoutEdgeInput {
  source: number;
  target: number;
  /** 0-1 normalised edge strength; stronger edges sit closer together. */
  strength: number;
}

export interface LayoutOptions {
  iterations?: number;
  idealLength?: number;
  repulsion?: number;
  gravity?: number;
  radius?: number;
}

export interface LayoutResult {
  positions: Float32Array;
  /** Bounding radius of the settled cloud, used to frame the camera. */
  extent: number;
}

/** Small deterministic PRNG so layouts are reproducible across server and client. */
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
  }
  return hash >>> 0;
}

/**
 * Relaxes the graph and returns normalised positions roughly inside a unit
 * ball. Normalising afterwards means callers can scale the result to whatever
 * world size they render and node sizes and spring lengths stay comparable
 * between a 6-node and a 60-node network.
 */
export function computeLayout(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  options: LayoutOptions = {},
): LayoutResult {
  const count = nodes.length;
  const positions = new Float32Array(Math.max(0, count * 3));
  if (count === 0) return { positions, extent: 0 };

  const iterations = options.iterations ?? 220;
  const gravity = options.gravity ?? 0.012;
  const seedRadius = options.radius ?? 1;
  const random = mulberry32(hashSeed(nodes.map((node) => node.id)));

  const weight = nodes.map((node) => Math.max(1, node.weight));
  const maxWeight = Math.max(...weight);

  // Golden-spiral sphere: even angular coverage and a stable starting point.
  for (let index = 0; index < count; index += 1) {
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * 2.399963 + random() * 0.6;
    const jitter = 0.85 + random() * 0.3;
    positions[index * 3] = Math.cos(theta) * ringRadius * seedRadius * jitter;
    positions[index * 3 + 1] = y * seedRadius * jitter;
    positions[index * 3 + 2] = Math.sin(theta) * ringRadius * seedRadius * jitter;
  }

  const idealLength = options.idealLength ?? 0.42;
  const repulsion = options.repulsion ?? 0.012;

  const velocity = new Float32Array(count * 3);
  const force = new Float32Array(count * 3);
  const distances = new Float32Array(edges.length);
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index]!;
    distances[index] = idealLength * (0.65 + 0.7 * (1 - edge.strength));
  }

  for (let step = 0; step < iterations; step += 1) {
    force.fill(0);

    // Repulsion — quadratic falloff keeps neighbours from overlapping without
    // every distant pair dominating the step.
    for (let a = 0; a < count; a += 1) {
      const ax = positions[a * 3]!;
      const ay = positions[a * 3 + 1]!;
      const az = positions[a * 3 + 2]!;
      const chargeA = 0.5 + weight[a]! / maxWeight;
      for (let b = a + 1; b < count; b += 1) {
        const dx = ax - positions[b * 3]!;
        const dy = ay - positions[b * 3 + 1]!;
        const dz = az - positions[b * 3 + 2]!;
        const squared = dx * dx + dy * dy + dz * dz + 1e-4;
        const inverse = 1 / Math.sqrt(squared);
        const chargeB = 0.5 + weight[b]! / maxWeight;
        const magnitude = (repulsion * chargeA * chargeB) / squared;
        const fx = dx * inverse * magnitude;
        const fy = dy * inverse * magnitude;
        const fz = dz * inverse * magnitude;
        force[a * 3]! += fx;
        force[a * 3 + 1]! += fy;
        force[a * 3 + 2]! += fz;
        force[b * 3]! -= fx;
        force[b * 3 + 1]! -= fy;
        force[b * 3 + 2]! -= fz;
      }
    }

    // Springs.
    for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index]!;
      const a = edge.source;
      const b = edge.target;
      const dx = positions[b * 3]! - positions[a * 3]!;
      const dy = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
      const dz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
      const pull = (distance - distances[index]!) * 0.5;
      const fx = (dx / distance) * pull;
      const fy = (dy / distance) * pull;
      const fz = (dz / distance) * pull;
      force[a * 3]! += fx;
      force[a * 3 + 1]! += fy;
      force[a * 3 + 2]! += fz;
      force[b * 3]! -= fx;
      force[b * 3 + 1]! -= fy;
      force[b * 3 + 2]! -= fz;
    }

    // Gravity plus integration with damping and a speed cap, so one badly
    // placed edge cannot fling a node across the scene.
    const cooling = 1 - step / (iterations * 1.4);
    for (let node = 0; node < count; node += 1) {
      const base = node * 3;
      force[base]! -= positions[base]! * gravity;
      force[base + 1]! -= positions[base + 1]! * gravity;
      force[base + 2]! -= positions[base + 2]! * gravity;
      for (let axis = 0; axis < 3; axis += 1) {
        velocity[base + axis] = (velocity[base + axis]! + force[base + axis]!) * 0.82;
        const cap = 0.12 * cooling + 0.01;
        velocity[base + axis] = Math.max(-cap, Math.min(cap, velocity[base + axis]!));
        positions[base + axis] = positions[base + axis]! + velocity[base + axis]!;
      }
    }
  }

  // Centre and normalise into a unit ball.
  const centre = [0, 0, 0];
  for (let node = 0; node < count; node += 1) {
    centre[0]! += positions[node * 3]! / count;
    centre[1]! += positions[node * 3 + 1]! / count;
    centre[2]! += positions[node * 3 + 2]! / count;
  }

  let maxDistance = 0;
  for (let node = 0; node < count; node += 1) {
    const x = positions[node * 3]! - centre[0]!;
    const y = positions[node * 3 + 1]! - centre[1]!;
    const z = positions[node * 3 + 2]! - centre[2]!;
    positions[node * 3] = x;
    positions[node * 3 + 1] = y;
    positions[node * 3 + 2] = z;
    maxDistance = Math.max(maxDistance, Math.sqrt(x * x + y * y + z * z));
  }

  const scale = maxDistance > 0 ? 1 / maxDistance : 1;
  for (let index = 0; index < positions.length; index += 1) positions[index] = positions[index]! * scale;

  return { positions, extent: 1 };
}
