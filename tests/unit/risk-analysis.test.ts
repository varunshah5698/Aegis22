import { describe, expect, it } from "vitest";

import {
  analysisLayout,
  closedDeck,
  curtainScores,
  distributionStats,
  explodedDeck,
  fanAngles,
  fanScale,
  paintOrder,
  signalFingerprint,
  ANALYSIS_MOODS,
} from "@/lib/risk/analysis";

const scene = { w: 1200, h: 520 };

describe("deck geometry", () => {
  it("keeps the headline card on its anchor when closed", () => {
    const meshes = closedDeck([100, 200], 340);
    expect(meshes).toHaveLength(5);
    expect(meshes[0]).toMatchObject({ card: "head", translate: { x: 100, y: 200 } });
    // The tail cards peek out along the diagonal, each further than the last.
    const tail = meshes.slice(1);
    expect(tail.map((mesh) => mesh.translate.x)).toEqual([...tail.map((mesh) => mesh.translate.x)].sort((a, b) => a - b));
    expect(tail[0]!.translate.y).toBeLessThan(200);
    expect(meshes[0]!.zIndex).toBeGreaterThan(tail[0]!.zIndex);
  });

  it("tears the deck apart on open without letting cards collide", () => {
    const from = analysisLayout({ open: 0, anchor: [100, 260], scene, cardWidth: 340 });
    const to = analysisLayout({ open: 1, anchor: [100, 260], scene, cardWidth: 340 });
    const midpoint = analysisLayout({ open: 0.5, anchor: [100, 260], scene, cardWidth: 340 });

    // Closed: headline sits exactly on the anchor.
    expect(from.meshes[0]!.translate.x).toBeCloseTo(100, 5);
    // Open: the headline moves to the left of centre and the tail to the right.
    expect(to.meshes[0]!.translate.x).toBeLessThan(scene.w / 2);
    expect(to.meshes.slice(1).every((mesh) => mesh.translate.x > to.meshes[0]!.translate.x)).toBe(true);
    // Mid-transition every card is between its endpoints.
    for (let index = 0; index < 5; index += 1) {
      const start = from.meshes[index]!.translate.x;
      const end = to.meshes[index]!.translate.x;
      const middle = midpoint.meshes[index]!.translate.x;
      expect(middle).toBeGreaterThanOrEqual(Math.min(start, end) - 0.001);
      expect(middle).toBeLessThanOrEqual(Math.max(start, end) + 0.001);
    }
  });

  it("gives every card a distinct slot in every mood", () => {
    for (const mood of ANALYSIS_MOODS) {
      const meshes = explodedDeck([0, 0], scene, mood, 1);
      const seen = new Set(
        meshes.map((mesh) => `${Math.round(mesh.translate.x / 40)}:${Math.round(mesh.translate.y / 40)}`),
      );
      expect(seen.size).toBe(5);
    }
  });

  it("paints the furthest card first", () => {
    const meshes = explodedDeck([0, 0], scene, ANALYSIS_MOODS[0]!, 1);
    const order = paintOrder(meshes);
    const depths = order.map((mesh) => mesh.translate.z);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });
});

describe("signal fingerprint", () => {
  it("always returns the full signal set, with missing signals at zero", () => {
    const rows = signalFingerprint([
      { id: "velocity", raw: 0.5, weight: 10, points: 3.4, triggered: true },
    ]);
    expect(rows).toHaveLength(10);
    const velocity = rows.find((row) => row.id === "velocity")!;
    expect(velocity.points).toBeCloseTo(3.4);
    expect(velocity.triggered).toBe(true);
    expect(rows.filter((row) => row.id !== "velocity").every((row) => row.raw === 0)).toBe(true);
    expect(rows.every((row) => row.label.length > 0)).toBe(true);
  });

  it("fans the bars symmetrically from the top", () => {
    const angles = fanAngles(5);
    expect(angles).toHaveLength(5);
    expect(angles[2]).toBeCloseTo(-Math.PI / 2);
    expect(angles[0]! + angles[4]!).toBeCloseTo(-Math.PI);
  });

  it("normalises the tallest bar to one", () => {
    const { max, normalised } = fanScale([0, 5, 10]);
    expect(max).toBe(10);
    expect(normalised).toEqual([0, 0.5, 1]);
    expect(fanScale([]).normalised).toEqual([]);
  });
});

describe("distribution stats", () => {
  it("computes the classic summary for a simple population", () => {
    const stats = distributionStats(150, [10, 20, 30, 40, 50]);
    expect(stats.n).toBe(5);
    expect(stats.median).toBe(30);
    expect(stats.mean).toBe(30);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.percentile).toBe(1);
    expect(stats.robustZ).not.toBeNull();
    expect(stats.upperFence).not.toBeNull();
  });

  it("survives empty and single-valued populations", () => {
    const empty = distributionStats(100, []);
    expect(empty.n).toBe(0);
    expect(empty.sd).toBeNull();
    expect(empty.pValue).toBeNull();
    expect(empty.percentile).toBe(0.5);

    const single = distributionStats(100, [50]);
    expect(single.sd).toBeNull();
    expect(single.z).toBeNull();
    expect(single.percentile).toBe(1);
  });

  it("reports a small tail probability for an extreme observation", () => {
    const population = Array.from({ length: 40 }, (_, index) => 1000 + index * 25);
    const typical = distributionStats(1200, population);
    const extreme = distributionStats(9000, population);
    expect(extreme.pValue!).toBeLessThan(0.01);
    expect(extreme.pValue!).toBeLessThan(typical.pValue!);
    expect(extreme.z!).toBeGreaterThan(3);
  });
});

describe("curtain scores", () => {
  it("re-scores each signal as if it were the only one that fired", () => {
    const rows = curtainScores(
      [
        { id: "velocity", raw: 1, weight: 10 },
        { id: "splitting_window", raw: 0.5, weight: 18 },
      ],
      100,
    );
    expect(rows).toEqual([
      { id: "velocity", score: 10 },
      { id: "splitting_window", score: 9 },
    ]);
  });

  it("never exceeds the score ceiling", () => {
    const rows = curtainScores([{ id: "velocity", raw: 50, weight: 400 }], 1);
    expect(rows[0]!.score).toBe(100);
  });
});
