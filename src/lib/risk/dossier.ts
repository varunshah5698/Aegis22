/**
 * Decision-dossier maths.
 *
 * The transaction workbench opens on a stack of cards floating in a small 3D
 * scene. Everything geometric lives here so it can be unit-tested without a
 * DOM: the perspective projection, the scroll-driven stack layout, the
 * statistical comparisons and the one-at-a-time sensitivity re-score.
 */

import { ALERT_CUTOFF, SCORE_BANDS, SIGNAL_WEIGHTS } from "@/config/risk";

// Rotation that takes the browser's screen axes onto a view down −Z (into the
// page) that looks 0° up, before yaw is applied. Holding it constant means a
// card at yaw 0 faces the reader exactly, even though it sits below the eye.
const TILT = (-14 * Math.PI) / 180;
const COS_TILT = Math.cos(TILT);
const SIN_TILT = Math.sin(TILT);

/** Scene dimensions in CSS pixels. */
export interface Scene {
  w: number;
  h: number;
  /** Eye distance from the scene centre. Larger is a flatter, tamer perspective. */
  dist: number;
}

export interface CardPose {
  /** Lateral offset in scene pixels (positive is right). */
  x: number;
  /** Depth offset in scene pixels (positive is further away). */
  y: number;
  /** Height offset in scene pixels (positive is up). */
  z: number;
  /** Ocean of the stack. Card 0 is the headline, negative values sit behind it. */
  depth: number;
  /** Yaw in radians. 0 faces the reader, +1.5 turns the back edge toward the viewer. */
  yaw: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Multiply by this to size a layer for its depth. 0 means behind the eye. */
  scale: number;
}

export function projectPoint(point: { x: number; y: number; z: number }, scene: Scene): ProjectedPoint {
  // Screen axes: x right, y down, z toward the viewer.
  const camX = point.x;
  const camY = point.y * COS_TILT + point.z * SIN_TILT;
  const camZ = point.z * COS_TILT - point.y * SIN_TILT;
  const depth = scene.dist - camZ;
  if (depth <= 1) return { x: 0, y: 0, scale: 0 };
  const scale = scene.dist / depth;
  return { x: camX * scale, y: camY * scale, scale };
}

/** Uniform scale for an axis-aligned layer that sits at `pose` — accurate for the card's centre. */
export function poseScale(pose: CardPose, scene: Scene): number {
  return projectPoint({ x: pose.x, y: pose.y, z: pose.z }, scene).scale;
}

/**
 * Scroll-driven stack. Card 0 lifts out of the fan into a workspace plane as the
 * page scrolls; every card behind it rises and peels forward so the whole deck
 * unrolls rather than sliding as one block.
 */
export function dossierPose(index: number, progress: number, scene: Scene): CardPose {
  const p = Math.min(1, Math.max(0, progress));
  const eased = p * p * (3 - 2 * p);
  const baseX = Math.min(112, Math.max(56, scene.w * 0.056));
  const baseZ = Math.min(84, Math.max(48, scene.h * 0.1));
  const depth = -index;
  const spread = eased * eased;

  const x = index * baseX * (1 - 0.82 * eased) * (1 - 0.14 * Math.max(0, index - 1));
  const y = index * baseZ * (1 - 0.7 * spread) + 26 * eased * Math.min(index, 2.4);
  const z = index * 6 * (1 - eased) + 10 * eased * index;
  const yaw = -((index + 1.2) * 0.085) * (1 - 0.6 * eased) + eased * index * 0.035;

  return { x, y, z, depth, yaw };
}

export interface StackLayout {
  /** Depth buffer scale, one entry per card. */
  layers: number[];
  card: {
    translate: [number, number];
    scale: number;
    rotateY: number;
    opacity: number;
  };
}

export function stackLayout(poses: CardPose[], scene: Scene): StackLayout {
  const layers = poses.map((pose) => Math.max(0, poseScale(pose, scene)));
  const head = poses[0];
  if (!head) return { layers, card: { translate: [0, 0], scale: 1, rotateY: 0, opacity: 1 } };
  const point = projectPoint({ x: head.x, y: head.y, z: 0 }, scene);
  return {
    layers,
    card: {
      translate: [point.x, point.y],
      scale: point.scale,
      rotateY: head.yaw,
      opacity: Math.min(1, Math.max(0, point.scale)),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? 0;
  return (lower + upper) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (n − 1). Needs at least two values. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mu = mean(values);
  if (mu === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Quantile with linear interpolation; `q` is 0-1. */
export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (position - lower);
}

/**
 * Share of the population at or below `value`. Mid-point rank, so ties and the
 * extreme ends never report a flat 0% or 100%.
 */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0.5;
  const below = values.filter((row) => row < value).length;
  const equal = values.filter((row) => row === value).length;
  return (below + equal / 2) / values.length;
}

export function ratioToMedian(value: number, medianValue: number | null): number | null {
  if (!medianValue || !Number.isFinite(medianValue) || medianValue === 0) return null;
  return value / medianValue;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 7.5e-8). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = sign * (1 - poly * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

/**
 * Two-sided p-value for a value under a normal reference (grouped transfers as
 * the reference distribution, this payment as the observation).
 */
export function tailProbability(value: number, referenceMean: number | null, referenceSd: number | null): number | null {
  if (referenceMean === null || referenceSd === null || referenceSd <= 0) return null;
  const z = (value - referenceMean) / referenceSd;
  return Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))));
}

/* -------------------------------------------------------------------------- */
/* Score bands and sensitivity                                                */
/* -------------------------------------------------------------------------- */

export interface SensitivityInput {
  id: string;
  raw: number;
  weight: number;
}

/**
 * Re-run the published scoring formula with one signal at full strength: zero
 * for every other signal. Answering "what does this decision rest on" without
 * presenting a different payment as if it were this one.
 */
export function signalLeverage(factors: SensitivityInput[], totalWeight = totalSignalWeight()) {
  return factors.map((factor) => {
    const weight = factor.weight || 0;
    const raw = Math.min(1, Math.max(0, factor.raw));
    const points = (raw * weight * 100) / (totalWeight || 1);
    return { id: factor.id, weight, raw, points, score: Math.round(clampScore(points)) };
  });
}

export function totalSignalWeight(): number {
  return Object.values(SIGNAL_WEIGHTS).reduce((sum, weight) => sum + weight, 0) || 1;
}

export function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export interface Decision {
  code: string;
  headline: string;
  detail: string;
  tone: "clear" | "review" | "block";
}

/** Turns a score and the alert record into the reviewer's next action. */
export function decisionFor(score: number, alerts: Array<{ severity: string; status: string }>): Decision {
  const open = alerts.some((alert) => alert.status !== "closed" && alert.status !== "resolved");
  if (score >= SCORE_BANDS.critical) {
    return { code: "BLOCK", headline: "Hold the payment", detail: "critical score · escalate to MLRO", tone: "block" };
  }
  if (score >= ALERT_CUTOFF || open) {
    return { code: "REVIEW", headline: "Analyst review", detail: "above the alert cutoff · manual triage", tone: "review" };
  }
  if (score >= SCORE_BANDS.medium) {
    return { code: "MONITOR", headline: "Monitor", detail: "below cutoff · sampled in periodic review", tone: "clear" };
  }
  return { code: "CLEAR", headline: "Straight through", detail: "no reporting obligation triggered", tone: "clear" };
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Splits a headline value into its numeric part and its unit, e.g. "87" + "/100". */
export function splitNumeric(value: string): { number: string; unit: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?[\d.,]+)(.*)$/);
  if (!match) return { number: trimmed, unit: "" };
  return { number: match[1] ?? trimmed, unit: (match[2] ?? "").trim() };
}
