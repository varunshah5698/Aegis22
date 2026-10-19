import type {
  AccountContext,
  AccountHistoryItem,
  RiskTransaction,
  ScoringContext,
  TransferEdge,
} from "@/lib/risk/types";

export const BASE_TIME = "2026-06-15T12:00:00.000Z";

export function makeTransaction(overrides: Partial<RiskTransaction> = {}): RiskTransaction {
  return {
    externalId: "TX-1",
    amount: 9_850,
    currency: "USD",
    amountBase: 9_850,
    senderAccountId: "acc-a",
    receiverAccountId: "acc-b",
    senderName: "Alpha Exports",
    receiverName: "Beta Trading",
    senderCountry: "US",
    receiverCountry: "DE",
    channel: "SWIFT",
    purposeCode: "TRADE",
    createdAt: BASE_TIME,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    id: "acc-a",
    entityId: "ent-a",
    entityName: "Alpha Exports",
    entityKind: "company",
    country: "US",
    currency: "USD",
    openedAt: "2023-01-10T00:00:00.000Z",
    incorporatedOn: "2020-05-01",
    pepFlag: false,
    nomineeEntityCount: 0,
    history: [],
    ...overrides,
  };
}

export function outbound(
  counterpartyId: string,
  amountBase: number,
  createdAt: string,
  overrides: Partial<AccountHistoryItem> = {},
): AccountHistoryItem {
  return {
    counterpartyId,
    corridor: "US-DE",
    amountBase,
    createdAt,
    direction: "out",
    ...overrides,
  };
}

export function inbound(
  counterpartyId: string,
  amountBase: number,
  createdAt: string,
): AccountHistoryItem {
  return {
    counterpartyId,
    corridor: "GB-US",
    amountBase,
    createdAt,
    direction: "in",
  };
}

export function edge(
  fromAccountId: string,
  toAccountId: string,
  amountBase: number,
  createdAt: string,
): TransferEdge {
  return { fromAccountId, toAccountId, amountBase, createdAt };
}

export function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    accounts: {
      "acc-a": makeAccount(),
      "acc-b": makeAccount({
        id: "acc-b",
        entityId: "ent-b",
        entityName: "Beta Trading",
        country: "DE",
        currency: "EUR",
      }),
    },
    recentTransfers: [],
    relatedAccounts: {},
    now: BASE_TIME,
    ...overrides,
  };
}
