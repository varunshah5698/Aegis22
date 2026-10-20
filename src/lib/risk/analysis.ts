/**
 * Maths for the tap-to-open analysis scene in the decision dossier.
 *
 * The dossier is a stack of cards in a small 3D geist: when a reviewer taps a
 * card the stack tears open along the corridor and the evidence geometry —
 * a contribution fan, an amount ladder, a depth-buffer score tower and a roll
 * of the cards themselves — floats into the space between. This module owns the
 * numbers behind that geometry so it can be tested without a DOM.
 *
 * Everything here is deterministic and pure; the DOM files only lay out what
 * these functions return.
 */

import { SIGNAL_LABELS, SIGNAL_WEIGHTS, type SignalId } from "@/config/risk";
import { clampScore, mean, median, quantile, stdDev, tailProbability } from "@/lib/risk/dossier";

/* -------------------------------------------------------------------------- */
/* Card stack geometry                                                        */
/* -------------------------------------------------------------------------- */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Mesh {
  card: "head" | number;
  /** Translate the card centre to this point. */
  translate: Vec3;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  /** 0-1; values below 0.05 are treated as unmounted. */
  opacity: number;
  blur: number;
  /** Paint order hint; higher is nearer the reviewer. */
  zIndex: number;
}

export interface AnalysisMood {
  yaw: number;
  pitch: number;
  /** Shuffles the exploded deck; bump this to fan the cards the other way. */
  jitter: number;
  /** -1 holds the cards open, +1 has pushed them apart. */
  exploded: number;
}

export interface AnalysisLayout {
  mood: AnalysisMood;
  /** One mesh per card. Index 0 is the headline card, then stacked 1-4. */
  meshes: Mesh[];
  /** The headline card translated in screen space, matching the closed deck. */
  anchor: { translate: [number, number]; scale: number; rotateY: number };
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const lerpVec = (from: Vec3, to: Vec3, t: number): Vec3 => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  z: lerp(from.z, to.z, t),
});

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const ANALYSIS_MOODS: AnalysisMood[] = [
  { yaw: -12, pitch: 6, jitter: 0, exploded: 0 },
  { yaw: 14, pitch: -5, jitter: 1, exploded: 1 },
  { yaw: -24, pitch: 2, jitter: -1, exploded: 1 },
  { yaw: 6, pitch: 9, jitter: 1, exploded: 1 },
];

/**
 * Closed deck: the headline card sits on a grid cell's anchor, the four cards
 * behind it peek out along a diagonal so the deck reads as paper.
 */
export function closedDeck(anchor: [number, number], cardWidth: number) {
  const step = Math.max(38, Math.min(58, cardWidth * 0.2));
  const meshes: Mesh[] = [
    {
      card: "head",
      translate: { x: anchor[0], y: anchor[1], z: 40 },
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      scale: 1,
      opacity: 1,
      blur: 0,
      zIndex: 40,
    },
  ];
  for (let index = 1; index <= 4; index += 1) {
    meshes.push({
      card: index,
      translate: { x: anchor[0] + step * index, y: anchor[1] - step * 0.6 * index, z: 40 - index * 4 },
      rotateX: 0,
      rotateY: -0.05 * index,
      rotateZ: 0,
      scale: 0.96 - index * 0.025,
      opacity: 1,
      blur: 0,
      zIndex: 40 - index,
    });
  }
  return meshes;
}

/**
 * Exploded deck: the cards tear apart along the corridor, fanning around the
 * headline card with real depth so they can be picked up and rolled.
 */
export function explodedDeck(
  anchor: [number, number],
  scene: { w: number; h: number },
  mood: AnalysisMood,
  spread = 1,
) {
  const radiusX = Math.max(120, Math.min(300, scene.w * 0.3));
  const radiusY = Math.max(70, Math.min(160, scene.h * 0.3));
  const slot = Math.max(0.5, spread);
  const meshes: Mesh[] = [
    {
      card: "head",
      translate: { x: anchor[0] - radiusX * 0.52 * slot, y: anchor[1] + 4, z: 150 + 30 * slot },
      rotateX: 4,
      rotateY: 18 + mood.yaw * 0.35,
      rotateZ: -2,
      scale: 0.92,
      opacity: 1,
      blur: 0,
      zIndex: 60,
    },
  ];
  // The tail cards fan out to the right of the headline, alternating above and
  // below the eye so no card can ever hide another.
  const offsets = [
    { x: 0.5, y: -0.74, z: -18 },
    { x: 0.86, y: 0.2, z: -64 },
    { x: 0.44, y: 0.96, z: 24 },
    { x: -0.32, y: 1.18, z: -40 },
  ];
  offsets.forEach((offset, index) => {
    const mirror = mood.jitter === -1 ? -1 : 1;
    meshes.push({
      card: index + 1,
      translate: {
        x: anchor[0] + radiusX * offset.x * slot,
        y: anchor[1] + radiusY * offset.y * slot * mirror,
        z: 40 + offset.z * slot + 20,
      },
      rotateX: -6 + index * 3,
      rotateY: -14 - index * 6 + mood.yaw * 0.2,
      rotateZ: mirror * (4 + index * 2),
      scale: 0.86 - index * 0.015,
      opacity: 1,
      blur: 0,
      zIndex: 60 - index,
    });
  });
  return meshes;
}

/**
 * Interpolates the deck between its closed state and the exploded scene.
 * `open` is 0-1 and eased so the cards settle rather than arrive at speed.
 */
export function analysisLayout(input: {
  open: number;
  anchor: [number, number];
  scene: { w: number; h: number };
  cardWidth: number;
  mood?: AnalysisMood;
}): AnalysisLayout {
  const { open, anchor, scene, cardWidth } = input;
  const mood = input.mood ?? ANALYSIS_MOODS[0]!;
  const t = easeInOutCubic(Math.min(1, Math.max(0, open)));
  const from = closedDeck(anchor, cardWidth);
  const to = explodedDeck(
    [scene.w / 2, scene.h * 0.44],
    scene,
    { ...mood, exploded: 1 },
    easeOutCubic(open),
  );
  const meshes = from.map((start, index): Mesh => {
    const end = to[index] ?? start;
    return {
      card: start.card,
      translate: lerpVec(start.translate, end.translate, t),
      rotateX: lerp(start.rotateX, end.rotateX, t),
      rotateY: lerp(start.rotateY, end.rotateY, t),
      rotateZ: lerp(start.rotateZ, end.rotateZ, t),
      scale: lerp(start.scale, end.scale, t),
      opacity: Math.min(start.opacity, end.opacity),
      blur: lerp(start.blur, end.blur, t),
      zIndex: Math.round(lerp(start.zIndex, end.zIndex, t)),
    };
  });
  return {
    mood,
    meshes,
    anchor: {
      translate: [lerp(anchor[0], scene.w / 2, t), lerp(anchor[1], scene.h * 0.44, t)],
      scale: lerp(1, 0.92, t),
      rotateY: lerp(0, explodedDeck([0, 0], scene, mood, 1)[0]!.rotateY, t),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Depth-buffer helpers                                                       */
/* -------------------------------------------------------------------------- */

/** Classic painter's sort: further z first, so nearer cards paint on top. */
export function paintOrder(meshes: Mesh[]): Mesh[] {
  return [...meshes].sort((a, b) => a.translate.z - b.translate.z || a.zIndex - b.zIndex);
}

/** Fog for distance: cards further back fade and soften so depth is legible. */
export function depthAtmosphere(mesh: Mesh, range: { near: number; far: number }) {
  const span = Math.max(1, range.far - range.near);
  const t = Math.min(1, Math.max(0, (mesh.translate.z - range.near) / span));
  return { opacity: 0.55 + 0.45 * t, blur: (1 - t) * 2.4 };
}

/* -------------------------------------------------------------------------- */
/* Signal fingerprints                                                        */
/* -------------------------------------------------------------------------- */

export interface SignalInput {
  id: SignalId;
  raw: number | null;
  weight: number;
  points: number;
  triggered: boolean;
  label: string;
}

/**
 * Every signal on the compass, including the ones that did not fire, so the
 * fan always shows the full denominator rather than a filtered view.
 */
export function signalFingerprint(
  contributions: Array<{ id: SignalId; raw: number; weight: number; points: number; triggered: boolean }>,
): SignalInput[] {
  const byId = new Map(contributions.map((row) => [row.id, row]));
  return (Object.keys(SIGNAL_WEIGHTS) as SignalId[]).map((id) => {
    const hit = byId.get(id);
    return {
      id,
      label: SIGNAL_LABELS[id],
      weight: hit?.weight ?? SIGNAL_WEIGHTS[id],
      raw: hit ? Math.min(1, Math.max(0, hit.raw)) : 0,
      points: Math.max(0, hit?.points ?? 0),
      triggered: Boolean(hit?.triggered),
    };
  });
}

/** Fan geometry: a half-circle starting at 12 o'clock, clockwise. */
export function fanAngles(count: number): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  const sweep = Math.PI * 1.55;
  const start = -Math.PI / 2 - sweep / 2;
  return Array.from({ length: count }, (_, index) => start + (sweep * index) / (count - 1));
}

/** Tallest bar in the scene sets the scale for every other bar. */
export function fanScale(values: number[]): { max: number; normalised: number[] } {
  const max = Math.max(...values, 0.0001);
  return { max, normalised: values.map((value) => Math.max(0, value) / max) };
}

/* -------------------------------------------------------------------------- */
/* Amount distribution                                                        */
/* -------------------------------------------------------------------------- */

export interface AmountStats {
  n: number;
  min: number;
  max: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  /** Mean + 1.5 IQR and mean − 1.5 IQR fence, the classic outlier rule. */
  upperFence: number | null;
  lowerFence: number | null;
  robustZ: number | null;
  z: number | null;
  pValue: number | null;
  percentile: number;
}

/**
 * Summary statistics for this amount against the grouped transfers, plus the
 * tail probability under the (admittedly rough) normal reference. The p-value
 * is presented as an indicative signal, never as a formal test result.
 */
export function distributionStats(value: number, population: number[]): AmountStats {
  const n = population.length;
  const mu = mean(population);
  const sd = stdDev(population);
  const med = median(population);
  const q1 = quantile(population, 0.25);
  const q3 = quantile(population, 0.75);
  const iqr = q1 !== null && q3 !== null ? q3 - q1 : null;
  const mad = med === null ? null : median(population.map((row) => Math.abs(row - med)));
  const sorted = [...population].sort((a, b) => a - b);
  const below = sorted.filter((row) => row < value).length;
  const equal = sorted.filter((row) => row === value).length;
  const percentile = n === 0 ? 0.5 : (below + equal / 2) / n;
  return {
    n,
    min: sorted[0] ?? value,
    max: sorted[sorted.length - 1] ?? value,
    mean: mu,
    median: med,
    sd,
    q1,
    q3,
    iqr,
    upperFence: q3 !== null && iqr !== null ? q3 + 1.5 * iqr : null,
    lowerFence: q1 !== null && iqr !== null ? q1 - 1.5 * iqr : null,
    robustZ: mad && mad > 0 && med !== null ? (0.6745 * (value - med)) / mad : null,
    z: sd && sd > 0 && mu !== null ? (value - mu) / sd : null,
    pValue: tailProbability(value, mu, sd),
    percentile,
  };
}

/* -------------------------------------------------------------------------- */
/* Sensitivity curtain                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Recompute the published score with one signal as the only contributor. Used
 * for the sortable curtain: it answers "how much of this decision rests on that
 * one signal" without pretending it is a forecast.
 */
export function curtainScores(
  factors: Array<{ id: SignalId; raw: number; weight: number }>,
  totalWeight: number,
): Array<{ id: SignalId; score: number }> {
  return factors.map((factor) => ({
    id: factor.id,
    score: Math.round(clampScore(((factor.raw * factor.weight) / Math.max(1, totalWeight)) * 100)),
  }));
}
