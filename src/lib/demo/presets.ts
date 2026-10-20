/** Presets shared by the generator and the Data library controls. */
export interface DemoPreset {
  id: string;
  label: string;
  payments: number;
  days: number;
  description: string;
}

export const DEMO_PRESETS: DemoPreset[] = [
  { id: "week", label: "1 week", payments: 400, days: 14, description: "Light history, fast to insert" },
  { id: "quarter", label: "1 quarter", payments: 1_500, days: 90, description: "Enough history for 90-day baselines" },
  { id: "year", label: "1 year", payments: 3_000, days: 365, description: "Full seasonal cycle, slower to build" },
];

export const MAX_DEMO_PAYMENTS = 3_000;
export const MAX_DEMO_DAYS = 365;
