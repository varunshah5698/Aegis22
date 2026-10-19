import type { RiskLevel } from "@/config/risk";

export interface DemoTransaction {
  id: string;
  time: string;
  sender: string;
  receiver: string;
  corridor: string;
  amount: number;
  currency: string;
  score: number;
  level: RiskLevel;
}

export const demoTransactions: DemoTransaction[] = [
  { id: "TX-9F41C2", time: "09:42:18", sender: "Northwind Trading", receiver: "Caspian Union Trade", corridor: "AE→IR", amount: 9_480, currency: "USD", score: 78, level: "high" },
  { id: "TX-9F41A8", time: "09:41:52", sender: "Halcyon Retail Ltd", receiver: "Brightline Supplies", corridor: "GB→DE", amount: 1_240, currency: "EUR", score: 18, level: "low" },
  { id: "TX-9F4180", time: "09:41:07", sender: "Meridian Freight", receiver: "Volga Marine", corridor: "AE→RU", amount: 42_900, currency: "USD", score: 91, level: "critical" },
  { id: "TX-9F4155", time: "09:40:31", sender: "Ardent Metals", receiver: "Zagros Holdings", corridor: "TR→IR", amount: 8_950, currency: "USD", score: 66, level: "high" },
  { id: "TX-9F4127", time: "09:39:44", sender: "Pinnacle Route", receiver: "Cobalt Logistics", corridor: "SG→MM", amount: 3_310, currency: "USD", score: 54, level: "medium" },
  { id: "TX-9F4102", time: "09:38:59", sender: "Solstice Transit", receiver: "Northgate Metals", corridor: "NL→AE", amount: 14_600, currency: "USD", score: 47, level: "medium" },
  { id: "TX-9F40D9", time: "09:38:12", sender: "Kite Retail", receiver: "Osaka Components", corridor: "US→JP", amount: 2_050, currency: "JPY", score: 12, level: "low" },
  { id: "TX-9F40B0", time: "09:37:35", sender: "Talos Holdings", receiver: "Damascus Route", corridor: "AE→SY", amount: 7_800, currency: "USD", score: 84, level: "critical" },
];

export const heroKpis = [
  { label: "Scanned today", value: 128_430, delta: 4.2, direction: "up" as const },
  { label: "Flagged", value: 1_284, delta: 2.8, direction: "up" as const, negative: true },
  { label: "Median latency", value: 186, suffix: " ms", delta: 6.1, direction: "down" as const },
];

export const demoCorridors = [
  { sender: "AE", receiver: "IR", volume: 4_820_000, flagged: 84, score: 88 },
  { sender: "PK", receiver: "MM", volume: 2_140_000, flagged: 51, score: 74 },
  { sender: "TR", receiver: "IR", volume: 1_910_000, flagged: 39, score: 71 },
  { sender: "AE", receiver: "RU", volume: 1_620_000, flagged: 33, score: 69 },
  { sender: "GB", receiver: "AE", volume: 9_400_000, flagged: 12, score: 38 },
];
