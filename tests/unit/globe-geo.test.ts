import { describe, expect, it } from "vitest";

import {
  COUNTRY_COORDINATES,
  countryCoordinates,
  greatCircleMidpoint,
  greatCirclePoints,
  latLonToVector3,
  vector3ToLatLon,
} from "@/lib/globe/geo";
import {
  DEMO_GLOBE_TRANSFERS,
  GLOBE_KIND_COLOR,
  GLOBE_KIND_DASHED,
  GLOBE_KIND_LABEL,
} from "@/lib/globe/transactions";

const close = (actual: number, expected: number, tolerance = 0.001) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

describe("globe geography", () => {
  it("projects the equirectangular texture axes correctly", () => {
    const equatorPrime = latLonToVector3(0, 0);
    close(equatorPrime.x, 1);
    close(equatorPrime.z, 0);

    const facing = latLonToVector3(0, -90);
    close(facing.z, 1);

    const pole = latLonToVector3(90, 0);
    close(pole.y, 1);
  });

  it("round-trips cities, including southern and western coordinates", () => {
    const cities = [
      { lat: 19.076, lon: 72.8777 },
      { lat: -23.5505, lon: -46.6333 },
      { lat: 40.7128, lon: -74.006 },
      { lat: 51.5074, lon: -0.1278 },
    ];

    for (const city of cities) {
      const point = latLonToVector3(city.lat, city.lon);
      const restored = vector3ToLatLon(point);
      close(restored.lat, city.lat);
      close(restored.lon, city.lon);
    }
  });

  it("builds arcs that start and end on the surface and rise above it", () => {
    const from = { lat: 19.076, lon: 72.8777 };
    const to = { lat: 1.3521, lon: 103.8198 };
    const points = greatCirclePoints(from, to, { radius: 1.004, segments: 48 });

    expect(points).toHaveLength(49);
    close(points[0]!.length(), 1.004);
    close(points[points.length - 1]!.length(), 1.004);

    const apex = points[Math.floor(points.length / 2)]!;
    expect(apex.length()).toBeGreaterThan(1.05);

    const start = vector3ToLatLon(points[0]!);
    close(start.lat, from.lat);
    close(start.lon, from.lon);
    const end = vector3ToLatLon(points[points.length - 1]!);
    close(end.lat, to.lat);
    close(end.lon, to.lon);
  });

  it("finds the geographic midpoint across the date line", () => {
    const simple = greatCircleMidpoint({ lat: 0, lon: 0 }, { lat: 0, lon: 90 });
    close(simple.lat, 0);
    close(simple.lon, 45);

    const pacific = greatCircleMidpoint({ lat: 10, lon: 170 }, { lat: 10, lon: -170 });
    close(pacific.lat, 10, 0.5);
    expect(Math.abs(pacific.lon)).toBeGreaterThan(179);
  });

  it("resolves ISO country codes to usable coordinates", () => {
    expect(countryCoordinates("sg")?.lon).toBeCloseTo(103.8, 1);
    expect(countryCoordinates("ZZ")).toBeNull();
    expect(COUNTRY_COORDINATES.GB!.lat).toBeGreaterThan(49);
  });
});

describe("demo globe transfers", () => {
  it("uses valid coordinates and known risk treatments", () => {
    for (const transfer of DEMO_GLOBE_TRANSFERS) {
      for (const location of [transfer.from, transfer.to]) {
        expect(location.lat).toBeGreaterThanOrEqual(-90);
        expect(location.lat).toBeLessThanOrEqual(90);
        expect(location.lon).toBeGreaterThanOrEqual(-180);
        expect(location.lon).toBeLessThanOrEqual(180);
        expect(COUNTRY_COORDINATES[location.country]).toBeDefined();
      }
      expect(transfer.amountUsd).toBeGreaterThan(0);
      expect(transfer.riskScore).toBeGreaterThanOrEqual(0);
      expect(transfer.riskScore).toBeLessThanOrEqual(100);
      expect(GLOBE_KIND_COLOR[transfer.kind]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(GLOBE_KIND_LABEL[transfer.kind]).toBeTruthy();
      expect(typeof GLOBE_KIND_DASHED[transfer.kind]).toBe("boolean");
    }
  });

  it("connects the named cities the copy refers to", () => {
    const singaporeToHongKong = DEMO_GLOBE_TRANSFERS.find(
      (transfer) => transfer.id === "singapore-hongkong-structuring",
    );
    expect(singaporeToHongKong?.from.city).toBe("Singapore");
    expect(singaporeToHongKong?.to.city).toBe("Hong Kong");

    const lagosToDubai = DEMO_GLOBE_TRANSFERS.find((transfer) => transfer.id === "lagos-dubai-corridor");
    expect(lagosToDubai?.from.city).toBe("Lagos");
    expect(lagosToDubai?.to.city).toBe("Dubai");
  });

  it("keeps every circular-flow leg in one emphasis group", () => {
    const loop = DEMO_GLOBE_TRANSFERS.filter((transfer) => transfer.kind === "circular");
    expect(loop.length).toBeGreaterThanOrEqual(3);
    const flowIds = new Set(loop.map((transfer) => transfer.flowId));
    expect(flowIds.size).toBe(1);
    expect([...flowIds][0]).toBeTruthy();
  });
});
