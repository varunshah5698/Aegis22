/**
 * Risk configuration.
 *
 * Every threshold, weight and tier below is intentionally data, not code, so a
 * compliance team can tune the model without touching the engine. Scores are
 * always 0-100 and are stamped with SCORING_MODEL_VERSION.
 */

export const riskLevels = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const signalIds = [
  "amount_threshold",
  "velocity",
  "high_risk_corridor",
  "new_counterparty",
  "splitting_window",
  "circular_path",
  "shell_intermediary",
  "first_time_corridor",
  "currency_mismatch",
  "pep_exposure",
] as const;
export type SignalId = (typeof signalIds)[number];

export const SIGNAL_WEIGHTS: Record<SignalId, number> = {
  amount_threshold: 8,
  velocity: 10,
  high_risk_corridor: 14,
  new_counterparty: 6,
  splitting_window: 18,
  circular_path: 16,
  shell_intermediary: 14,
  first_time_corridor: 6,
  currency_mismatch: 4,
  pep_exposure: 4,
};

export const SIGNAL_LABELS: Record<SignalId, string> = {
  amount_threshold: "Amount proximity to reporting threshold",
  velocity: "Velocity against 90-day baseline",
  high_risk_corridor: "High-risk corridor",
  new_counterparty: "New counterparty",
  splitting_window: "Splitting window",
  circular_path: "Circular flow",
  shell_intermediary: "Intermediary indicators",
  first_time_corridor: "First-time corridor",
  currency_mismatch: "Currency and country mismatch",
  pep_exposure: "PEP exposure",
};

/** Score boundaries. `alert` is the cutoff used to create alerts. */
export const SCORE_BANDS = {
  medium: 40,
  high: 70,
  critical: 85,
  alert: 60,
} as const;

export const ALERT_CUTOFF = SCORE_BANDS.alert;

export const REPORTING_THRESHOLD_USD = 10_000;
export const REPORTING_THRESHOLD_NOTE =
  "USD 10,000 is the reference reporting threshold used by the demo model. It is configurable and does not replace jurisdiction-specific obligations.";

export const SPLITTING = {
  windowHours: 24,
  minimumTransactions: 6,
  /** A transaction counts as sub-threshold when it is below 99% of the threshold. */
  subThresholdRatio: 0.99,
  minimumRelatedAccounts: 1,
} as const;

export const CIRCULAR_FLOW = {
  maxHops: 4,
  windowHours: 72,
  /** Each hop must retain at least 90% of the prior hop's value to be a circular flow. */
  minimumRetainedRatio: 0.9,
} as const;

export const VELOCITY = {
  baselineDays: 90,
  zScoreCap: 3,
  minimumBaselineTransactions: 5,
} as const;

export const SHELL_INTERMEDIARY = {
  maxAgeDays: 90,
  passThroughRatio: 0.9,
  passThroughHours: 6,
  nomineeSharedEntityCount: 3,
} as const;

export const SLA_HOURS: Record<RiskLevel, number> = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 48,
};

export const ALERT_SEVERITY_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type CountryRiskTier = "standard" | "elevated" | "high" | "critical";

/**
 * Jurisdiction tiers. This is a demo configuration, not a legal determination.
 * The list is deliberately conservative and must be reviewed by compliance
 * counsel before production use.
 */
export const COUNTRY_RISK_TIERS: Record<string, CountryRiskTier> = {
  AF: "critical",
  IR: "critical",
  KP: "critical",
  SY: "critical",
  YE: "critical",
  BY: "high",
  CU: "high",
  LY: "high",
  MM: "high",
  RU: "high",
  SD: "high",
  SS: "high",
  VE: "high",
  AE: "elevated",
  BD: "elevated",
  KY: "elevated",
  MT: "elevated",
  NG: "elevated",
  PA: "elevated",
  PK: "elevated",
  TR: "elevated",
};

export const COUNTRY_TIER_VALUE: Record<CountryRiskTier, number> = {
  standard: 0.08,
  elevated: 0.5,
  high: 0.8,
  critical: 1,
};

export const COUNTRY_TIER_LABEL: Record<CountryRiskTier, string> = {
  standard: "Standard",
  elevated: "Elevated",
  high: "High",
  critical: "Critical",
};

export function countryTier(countryCode: string): CountryRiskTier {
  return COUNTRY_RISK_TIERS[countryCode.toUpperCase()] ?? "standard";
}

export function corridorTier(senderCountry: string, receiverCountry: string): CountryRiskTier {
  const order: CountryRiskTier[] = ["standard", "elevated", "high", "critical"];
  const a = countryTier(senderCountry);
  const b = countryTier(receiverCountry);
  return order[Math.max(order.indexOf(a), order.indexOf(b))] ?? "standard";
}

export function corridorRiskValue(senderCountry: string, receiverCountry: string): number {
  return COUNTRY_TIER_VALUE[corridorTier(senderCountry, receiverCountry)];
}

/** Currencies used by the demo dataset and accepted by the score endpoint. */
export const currencyCountryMap: Record<string, string> = {
  USD: "US",
  GBP: "GB",
  EUR: "DE",
  INR: "IN",
  AED: "AE",
  SGD: "SG",
  JPY: "JP",
  CNY: "CN",
  BRL: "BR",
  CHF: "CH",
  AUD: "AU",
  CAD: "CA",
  HKD: "HK",
  ZAR: "ZA",
  NGN: "NG",
  KES: "KE",
  TRY: "TR",
  MXN: "MX",
};

export const supportedCurrencies = Object.keys(currencyCountryMap);

/** ISO 3166-1 alpha-2 codes used across the demo. */
export const supportedCountries = [
  "AE", "AR", "AU", "BD", "BE", "BR", "CA", "CH", "CN", "DE", "EG", "ES", "FR", "GB", "GH",
  "HK", "ID", "IE", "IL", "IN", "IT", "JP", "KE", "KR", "KW", "LK", "LU", "MA", "MX", "MY",
  "NG", "NL", "NO", "NZ", "OM", "PH", "PK", "PL", "QA", "SA", "SE", "SG", "TH", "TR", "TW",
  "UA", "US", "VN", "ZA",
  // High-risk jurisdictions are supported as inputs so monitoring covers them.
  "AF", "BY", "CU", "IR", "KP", "LY", "MM", "RU", "SD", "SS", "SY", "VE", "YE",
] as const;

export const MODEL_VERSION = process.env.SCORING_MODEL_VERSION ?? "v1";

/**
 * Coefficients for WeightedEnsembleScorer. Values are intentionally modest so
 * the rule score remains the dominant, auditable component.
 */
export const ENSEMBLE = {
  intercept: -2.4,
  /** Coefficient applied to each signal's raw 0-1 value. */
  coefficients: {
    amount_threshold: 0.35,
    velocity: 0.55,
    high_risk_corridor: 0.9,
    new_counterparty: 0.3,
    splitting_window: 1.15,
    circular_path: 1.25,
    shell_intermediary: 1.0,
    first_time_corridor: 0.25,
    currency_mismatch: 0.2,
    pep_exposure: 0.45,
  } satisfies Record<SignalId, number>,
  ruleWeight: 0.6,
  modelWeight: 0.4,
} as const;

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#2DD4BF",
  medium: "#F0B250",
  high: "#FB923C",
  critical: "#F45E5E",
};

/**
 * RGB triples for the same four levels, so a glow can be painted as
 * `rgba(r, g, b, a)` on canvas without re-parsing hex strings.
 */
export const RISK_RGB: Record<RiskLevel, [number, number, number]> = {
  low: [45, 212, 191],
  medium: [240, 178, 80],
  high: [251, 146, 60],
  critical: [244, 94, 94],
};

export function riskGlow(level: RiskLevel, alpha: number): string {
  const [r, g, b] = RISK_RGB[level];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared chart accents so every page speaks the same colour language. */
export const CHART_COLORS = {
  teal: "#2DD4BF",
  blue: "#60A5FA",
  amber: "#F0B250",
  violet: "#A78BFA",
  slate: "#94A3B8",
} as const;

export const statusColors = {
  new: "#F45E5E",
  investigating: "#F0B250",
  escalated: "#FB923C",
  resolved: "#2DD4BF",
  false_positive: "#94A3B8",
} as const;

/** Limits that protect the API and the browser from oversized work. */
export const LIMITS = {
  ingestBatch: 500,
  scoreBatch: 500,
  bulkAlerts: 200,
  graphNodes: 500,
  exportRows: 50_000,
  simulationTransactions: 100_000,
  pageSize: 50,
  maxPageSize: 200,
} as const;

export const TAT = {
  alertAcknowledgementMinutes: 15,
  caseFirstActionHours: 24,
} as const;

export function scoreToLevel(score: number): RiskLevel {
  if (score >= SCORE_BANDS.critical) return "critical";
  if (score >= SCORE_BANDS.high) return "high";
  if (score >= SCORE_BANDS.medium) return "medium";
  return "low";
}
