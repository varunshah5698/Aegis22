import type { RiskLevel } from "@/config/risk";

import type { LatLon } from "./geo";

/**
 * Demo adapter for the globe.
 *
 * This is the only place the hero visualization gets its events. Every record
 * is explicitly simulated and carries city-level coordinates, so the arcs,
 * particles and markers are generated from geography rather than screen
 * positions. A real feed can replace `DEMO_GLOBE_TRANSFERS` with rows mapped
 * through `countryCoordinates()` without changing the renderer.
 */

export type GlobeEventKind = "cleared" | "elevated" | "structuring" | "corridor" | "circular";

export interface GlobeLocation extends LatLon {
  city: string;
  country: string;
}

export interface GlobeTransfer {
  id: string;
  reference: string;
  kind: GlobeEventKind;
  from: GlobeLocation;
  to: GlobeLocation;
  amountUsd: number;
  currency: string;
  riskScore: number;
  riskLevel: RiskLevel;
  /** Risk classification shown in the detail panel. */
  classification: string;
  /** Analyst-facing explanation of the evidence behind the event. */
  note: string;
  /** Relative timestamp keeps the demo copy deterministic (no hydration drift). */
  observedMinutesAgo: number;
  /** Legs that share a flow id are emphasised together. */
  flowId?: string;
}

export const GLOBE_KIND_LABEL: Record<GlobeEventKind, string> = {
  cleared: "Cleared",
  elevated: "Elevated risk",
  structuring: "Structuring",
  corridor: "High-risk corridor",
  circular: "Circular flow",
};

/** Route colours are shared by the WebGL layer and the HTML legend. */
export const GLOBE_KIND_COLOR: Record<GlobeEventKind, string> = {
  cleared: "#2dd4bf",
  elevated: "#f0b250",
  structuring: "#f0b250",
  corridor: "#f85149",
  circular: "#f85149",
};

export const GLOBE_KIND_DASHED: Record<GlobeEventKind, boolean> = {
  cleared: false,
  elevated: false,
  structuring: true,
  corridor: false,
  circular: true,
};

export const DEMO_GLOBE_TRANSFERS: GlobeTransfer[] = [
  {
    id: "mumbai-singapore",
    reference: "GLB-24817",
    kind: "cleared",
    from: { city: "Mumbai", country: "IN", lat: 19.076, lon: 72.8777 },
    to: { city: "Singapore", country: "SG", lat: 1.3521, lon: 103.8198 },
    amountUsd: 184_500,
    currency: "USD",
    riskScore: 34,
    riskLevel: "low",
    classification: "Cleared — inside baseline",
    note: "Corridor and amount are consistent with the account's 90-day pattern. No signal crossed its threshold.",
    observedMinutesAgo: 2,
  },
  {
    id: "singapore-hongkong-structuring",
    reference: "GLB-24812",
    kind: "structuring",
    from: { city: "Singapore", country: "SG", lat: 1.3521, lon: 103.8198 },
    to: { city: "Hong Kong", country: "HK", lat: 22.3193, lon: 114.1694 },
    amountUsd: 8_940,
    currency: "USD",
    riskScore: 78,
    riskLevel: "high",
    classification: "Structuring under reporting threshold",
    note: "Seven payments sit below the reference threshold inside a six-hour window, across three related accounts.",
    observedMinutesAgo: 6,
    flowId: "structuring-sg-hk",
  },
  {
    id: "lagos-dubai-corridor",
    reference: "GLB-24809",
    kind: "corridor",
    from: { city: "Lagos", country: "NG", lat: 6.5244, lon: 3.3792 },
    to: { city: "Dubai", country: "AE", lat: 25.2048, lon: 55.2708 },
    amountUsd: 48_200,
    currency: "USD",
    riskScore: 92,
    riskLevel: "critical",
    classification: "High-risk corridor",
    note: "First transfer on this corridor for the account. The counterparty is marked as politically exposed.",
    observedMinutesAgo: 11,
  },
  {
    id: "zurich-singapore-loop",
    reference: "GLB-24801",
    kind: "circular",
    from: { city: "Zurich", country: "CH", lat: 47.3769, lon: 8.5417 },
    to: { city: "Singapore", country: "SG", lat: 1.3521, lon: 103.8198 },
    amountUsd: 72_300,
    currency: "USD",
    riskScore: 88,
    riskLevel: "critical",
    classification: "Circular flow — leg 1 of 3",
    note: "Funds return to the originating entity within 61 hours. Value retention on each hop is above 90%.",
    observedMinutesAgo: 16,
    flowId: "loop-zurich-singapore-dubai",
  },
  {
    id: "singapore-dubai-loop",
    reference: "GLB-24802",
    kind: "circular",
    from: { city: "Singapore", country: "SG", lat: 1.3521, lon: 103.8198 },
    to: { city: "Dubai", country: "AE", lat: 25.2048, lon: 55.2708 },
    amountUsd: 66_100,
    currency: "USD",
    riskScore: 88,
    riskLevel: "critical",
    classification: "Circular flow — leg 2 of 3",
    note: "Second hop through an intermediary with shared directors. Payment purpose differs from the prior leg.",
    observedMinutesAgo: 14,
    flowId: "loop-zurich-singapore-dubai",
  },
  {
    id: "dubai-zurich-loop",
    reference: "GLB-24803",
    kind: "circular",
    from: { city: "Dubai", country: "AE", lat: 25.2048, lon: 55.2708 },
    to: { city: "Zurich", country: "CH", lat: 47.3769, lon: 8.5417 },
    amountUsd: 64_400,
    currency: "USD",
    riskScore: 88,
    riskLevel: "critical",
    classification: "Circular flow — leg 3 of 3",
    note: "The loop closes back at the originating entity. $212,400 returned inside 61 hours.",
    observedMinutesAgo: 12,
    flowId: "loop-zurich-singapore-dubai",
  },
  {
    id: "london-newyork",
    reference: "GLB-24796",
    kind: "cleared",
    from: { city: "London", country: "GB", lat: 51.5074, lon: -0.1278 },
    to: { city: "New York", country: "US", lat: 40.7128, lon: -74.006 },
    amountUsd: 412_000,
    currency: "USD",
    riskScore: 18,
    riskLevel: "low",
    classification: "Cleared — inside baseline",
    note: "Established counterparty, four years of activity, amount in line with the account's median transfer.",
    observedMinutesAgo: 14,
  },
  {
    id: "frankfurt-mumbai",
    reference: "GLB-24791",
    kind: "elevated",
    from: { city: "Frankfurt", country: "DE", lat: 50.1109, lon: 8.6821 },
    to: { city: "Mumbai", country: "IN", lat: 19.076, lon: 72.8777 },
    amountUsd: 96_750,
    currency: "EUR",
    riskScore: 54,
    riskLevel: "medium",
    classification: "Velocity above baseline",
    note: "Third transfer to the same beneficiary in 24 hours. Volume is 2.4× the trailing 90-day median.",
    observedMinutesAgo: 18,
  },
  {
    id: "hongkong-vancouver",
    reference: "GLB-24784",
    kind: "elevated",
    from: { city: "Hong Kong", country: "HK", lat: 22.3193, lon: 114.1694 },
    to: { city: "Vancouver", country: "CA", lat: 49.2827, lon: -123.1207 },
    amountUsd: 121_000,
    currency: "USD",
    riskScore: 71,
    riskLevel: "high",
    classification: "Layering pattern",
    note: "Funds pass through a new intermediary account before continuing to a jurisdiction with no prior activity.",
    observedMinutesAgo: 23,
  },
  {
    id: "nairobi-london",
    reference: "GLB-24779",
    kind: "elevated",
    from: { city: "Nairobi", country: "KE", lat: -1.2921, lon: 36.8219 },
    to: { city: "London", country: "GB", lat: 51.5074, lon: -0.1278 },
    amountUsd: 38_400,
    currency: "USD",
    riskScore: 46,
    riskLevel: "medium",
    classification: "First-time corridor",
    note: "No prior settlement between these counterparties. Ownership data is incomplete for the beneficiary.",
    observedMinutesAgo: 31,
  },
  {
    id: "saopaulo-lisbon",
    reference: "GLB-24772",
    kind: "elevated",
    from: { city: "São Paulo", country: "BR", lat: -23.5505, lon: -46.6333 },
    to: { city: "Lisbon", country: "PT", lat: 38.7223, lon: -9.1393 },
    amountUsd: 57_900,
    currency: "USD",
    riskScore: 63,
    riskLevel: "medium",
    classification: "Currency and country mismatch",
    note: "Settlement currency differs from both counterparties' registered jurisdictions.",
    observedMinutesAgo: 38,
  },
  {
    id: "seoul-tokyo",
    reference: "GLB-24766",
    kind: "cleared",
    from: { city: "Seoul", country: "KR", lat: 37.5665, lon: 126.978 },
    to: { city: "Tokyo", country: "JP", lat: 35.6762, lon: 139.6503 },
    amountUsd: 16_400,
    currency: "USD",
    riskScore: 22,
    riskLevel: "low",
    classification: "Cleared — inside baseline",
    note: "Recurring supplier payment. Amount, corridor and timing all match the established pattern.",
    observedMinutesAgo: 44,
  },
];

export const GLOBE_DEMO_LABEL = "Simulated activity — demo dataset";

export function formatObservedAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}
