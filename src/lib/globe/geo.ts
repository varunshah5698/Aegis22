import { Vector3 } from "three";

/**
 * Geographic → sphere math for the globe.
 *
 * The mapping matches the equirectangular Earth textures (and three.js'
 * SphereGeometry UVs): longitude 0° sits on +X, longitude -90° faces +Z, and
 * the north pole is +Y. Every route, marker and particle is built from these
 * helpers, so everything stays pinned to the same physical surface as the
 * planet turns.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const DEG = Math.PI / 180;

export function latLonToVector3(lat: number, lon: number, radius = 1): Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function vector3ToLatLon(point: Vector3): LatLon {
  const normalized = point.clone().normalize();
  return {
    lat: Math.asin(normalized.y) / DEG,
    lon: wrapLongitude(Math.atan2(normalized.z, -normalized.x) / DEG - 180),
  };
}

/** Normalises a longitude into [-180, 180). */
export function wrapLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Samples a great-circle path between two geographies and lifts it above the
 * surface. The endpoints sit exactly on `radius`; the apex grows with the
 * angular distance so a short hop stays low and a long-haul corridor sweeps
 * visibly across the planet.
 */
export function greatCirclePoints(
  from: LatLon,
  to: LatLon,
  {
    radius = 1.002,
    segments = 72,
    minLift = 0.035,
    maxLift = 0.26,
  }: { radius?: number; segments?: number; minLift?: number; maxLift?: number } = {},
): Vector3[] {
  const a = latLonToVector3(from.lat, from.lon, 1);
  const b = latLonToVector3(to.lat, to.lon, 1);
  const angle = Math.acos(clamp(a.dot(b), -1, 1));
  const lift = minLift + (maxLift - minLift) * (angle / Math.PI);
  const points: Vector3[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point =
      angle < 1e-4
        ? a.clone()
        : a.clone().multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle)).add(
            b.clone().multiplyScalar(Math.sin(t * angle) / Math.sin(angle)),
          );
    const height = radius + Math.sin(Math.PI * t) * lift;
    points.push(point.normalize().multiplyScalar(height));
  }

  return points;
}

/** The point halfway along the great circle, used to aim the camera. */
export function greatCircleMidpoint(from: LatLon, to: LatLon): LatLon {
  const a = latLonToVector3(from.lat, from.lon, 1);
  const b = latLonToVector3(to.lat, to.lon, 1);
  const mid = a.clone().add(b);
  if (mid.lengthSq() < 1e-8) return from;
  return vector3ToLatLon(mid);
}

/**
 * Country-level fallback coordinates. The application's transaction rows only
 * carry ISO country codes, so this table is what lets a real row become a
 * geographic route. Values are approximate country centroids, not capitals.
 */
export const COUNTRY_COORDINATES: Record<string, LatLon> = {
  AE: { lat: 24.0, lon: 54.0 },
  AU: { lat: -25.3, lon: 133.8 },
  BR: { lat: -10.8, lon: -52.9 },
  BV: { lat: -54.4, lon: 3.4 },
  CA: { lat: 56.1, lon: -106.3 },
  CH: { lat: 46.8, lon: 8.2 },
  CN: { lat: 35.9, lon: 104.2 },
  DE: { lat: 51.2, lon: 10.4 },
  FR: { lat: 46.6, lon: 2.2 },
  GB: { lat: 54.0, lon: -2.0 },
  HK: { lat: 22.3, lon: 114.2 },
  ID: { lat: -2.5, lon: 118.0 },
  IN: { lat: 21.0, lon: 78.0 },
  IR: { lat: 32.4, lon: 53.7 },
  JP: { lat: 36.2, lon: 138.3 },
  KE: { lat: 0.2, lon: 37.9 },
  MM: { lat: 21.9, lon: 95.9 },
  MX: { lat: 23.6, lon: -102.6 },
  MY: { lat: 4.2, lon: 101.98 },
  NG: { lat: 9.1, lon: 8.7 },
  NL: { lat: 52.1, lon: 5.3 },
  KR: { lat: 36.5, lon: 127.9 },
  PH: { lat: 12.9, lon: 121.8 },
  PK: { lat: 30.4, lon: 69.3 },
  PT: { lat: 39.4, lon: -8.2 },
  RU: { lat: 61.5, lon: 95.0 },
  SA: { lat: 24.7, lon: 45.0 },
  SG: { lat: 1.3521, lon: 103.8198 },
  TH: { lat: 15.9, lon: 101.0 },
  TR: { lat: 39.0, lon: 35.2 },
  US: { lat: 39.8, lon: -98.6 },
  ZA: { lat: -29.0, lon: 24.0 },
};

export function countryCoordinates(code: string): LatLon | null {
  return COUNTRY_COORDINATES[code.trim().toUpperCase()] ?? null;
}
