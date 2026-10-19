import type { RiskTransaction } from "@/lib/risk/types";

export interface SeedEntity {
  id: string;
  organizationId: string;
  kind: "individual" | "company" | "intermediary";
  legalName: string;
  country: string;
  incorporatedOn: string | null;
  registrationNumber: string | null;
  pepFlag: boolean;
  nomineeDirectorName: string | null;
  metadata: Record<string, string>;
}

export interface SeedAccount {
  id: string;
  organizationId: string;
  externalRef: string;
  entityId: string;
  country: string;
  currency: string;
  status: "active" | "frozen" | "closed";
  openedAt: string;
  riskTier: "low" | "medium" | "high" | "critical";
}

export interface SeedTransaction extends RiskTransaction {
  organizationId: string;
  planted?: string;
}

export interface GeneratedOrgData {
  entities: SeedEntity[];
  accounts: SeedAccount[];
  transactions: SeedTransaction[];
  /** Explicit relationship links between accounts (shared device, nominee, manual). */
  relations: Map<string, Set<string>>;
  nomineeCounts: Map<string, number>;
}
