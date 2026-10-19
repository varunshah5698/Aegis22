import type { RiskLevel, SignalId } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";

export type EntityKind = "individual" | "company" | "intermediary";

export interface RiskTransaction {
  id?: string;
  externalId: string;
  amount: number;
  currency: string;
  amountBase: number;
  senderAccountId: string;
  receiverAccountId: string;
  senderName: string;
  receiverName: string;
  senderCountry: string;
  receiverCountry: string;
  channel: string;
  purposeCode?: string | null;
  createdAt: string;
}

export interface AccountHistoryItem {
  counterpartyId: string;
  corridor: string;
  amountBase: number;
  createdAt: string;
  direction: "in" | "out";
  externalId?: string;
}

export interface AccountContext {
  id: string;
  entityId: string;
  entityName: string;
  entityKind: EntityKind;
  country: string;
  currency: string;
  openedAt: string;
  incorporatedOn?: string | null;
  pepFlag: boolean;
  nomineeEntityCount: number;
  /** Transfers in both directions over the lookback window, unsorted is fine. */
  history: AccountHistoryItem[];
}

export interface TransferEdge {
  fromAccountId: string;
  toAccountId: string;
  amountBase: number;
  createdAt: string;
}

export interface ScoringContext {
  accounts: Record<string, AccountContext>;
  /** Edges in the last 72 hours, used for circular-flow detection. */
  recentTransfers: TransferEdge[];
  /** Accounts connected by shared device, address, nominee or a manual link. */
  relatedAccounts: Record<string, string[]>;
  now?: string;
}

export interface SignalResult {
  id: SignalId;
  /** Raw 0-1 strength before weighting. */
  raw: number;
  narrative: string;
  facts: Record<string, string | number | boolean>;
}

export interface SignalContribution {
  id: SignalId;
  label: string;
  raw: number;
  weight: number;
  points: number;
  triggered: boolean;
  narrative: string;
  facts: Record<string, string | number | boolean>;
}

export interface ScoreExplanation {
  summary: string;
  bullets: string[];
}

export interface ScoreResult {
  score: number;
  level: RiskLevel;
  contributions: SignalContribution[];
  explanation: ScoreExplanation;
  modelVersion: string;
  model: string;
}

export type SignalFunction = (
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig,
) => SignalResult;

export interface Scorer {
  readonly id: string;
  readonly version: string;
  score(transaction: RiskTransaction, context: ScoringContext): ScoreResult;
}
