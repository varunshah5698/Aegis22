/**
 * SentinelFlow demo seed.
 *
 * - Deterministic: identical ids and values on every run.
 * - Idempotent: upserts on stable keys, so running it twice is safe.
 * - Uses the real scoring module, so every seeded transaction carries a genuine
 *   risk score, explanation and alert decision.
 * - Runs through the public API as the demo actors, so every insert is subject
 *   to the same row-level security policies as the application.
 *
 * Usage: pnpm db:seed
 */
import { createHash } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { SCORE_BANDS } from "@/config/risk";
import { defaultRiskConfig } from "@/lib/risk/config";
import { scoreWithSignals } from "@/lib/risk/engine";
import type { AccountHistoryItem, ScoringContext, TransferEdge } from "@/lib/risk/types";
import { definitionHash } from "@/lib/schemas/rule";
import { seedRules } from "@/lib/rules/defaults";
import type { Database, Json, TablesInsert } from "@/lib/supabase/database.types";

import { addPlantedPatterns, currencyFor } from "./seed/planted";
import type { GeneratedOrgData, SeedAccount, SeedEntity, SeedTransaction } from "./seed/types";

loadEnv({ path: ".env.local" });

const DEMO_PASSWORD = "Sentinel-Demo-2026!";
const ORG_NORTHWIND = "11111111-1111-4111-8111-111111111111";
const ORG_MERIDIAN = "22222222-2222-4222-8222-222222222222";
const ADMIN_NORTHWIND = "00000000-0000-4000-8000-000000000101";
const ANALYST_NORTHWIND = "00000000-0000-4000-8000-000000000102";
const ANALYST_MERIDIAN = "00000000-0000-4000-8000-000000000202";

const DAYS = 180;
const NOW = new Date();

// ------------------------------------------------------------------ utilities

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function detId(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(random: () => number, entries: Array<[T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = random() * total;
  for (const [value, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  AED: 0.272,
  SGD: 0.74,
  JPY: 0.0064,
  CNY: 0.14,
  BRL: 0.18,
  CHF: 1.12,
  AUD: 0.66,
  CAD: 0.73,
  HKD: 0.128,
  ZAR: 0.055,
  NGN: 0.00065,
  KES: 0.0077,
  TRY: 0.029,
  MXN: 0.058,
  PKR: 0.0036,
};

const SENDER_WEIGHTS: Record<string, number> = {
  US: 0.2, GB: 0.12, DE: 0.09, AE: 0.08, IN: 0.07, SG: 0.06, CN: 0.05, PK: 0.04,
  NG: 0.03, KE: 0.02, TR: 0.03, ZA: 0.03, JP: 0.02, CH: 0.02, AU: 0.02, CA: 0.03,
  HK: 0.02, BR: 0.02, MX: 0.02, KY: 0.01,
};

const CORRIDORS: Array<[string, string, number]> = [
  ["US", "DE", 0.11],
  ["US", "GB", 0.09],
  ["US", "MX", 0.06],
  ["US", "IN", 0.05],
  ["US", "CA", 0.04],
  ["US", "BR", 0.03],
  ["US", "AE", 0.03],
  ["GB", "NG", 0.05],
  ["GB", "IN", 0.04],
  ["GB", "US", 0.03],
  ["AE", "IN", 0.07],
  ["AE", "PK", 0.03],
  ["SG", "CN", 0.05],
  ["SG", "AE", 0.03],
  ["CN", "SG", 0.04],
  ["DE", "PL", 0.03],
  ["DE", "US", 0.03],
  ["CH", "GB", 0.03],
  ["IN", "AE", 0.05],
  ["IN", "GB", 0.03],
  ["HK", "CN", 0.03],
  ["JP", "SG", 0.03],
  ["KE", "AE", 0.02],
  ["ZA", "GB", 0.02],
  ["TR", "DE", 0.02],
  ["NG", "GB", 0.02],
  ["AU", "SG", 0.03],
  ["MX", "US", 0.03],
  ["PK", "AE", 0.03],
  ["BR", "US", 0.02],
];

const PURPOSE_CODES: Array<[string, number]> = [
  ["TRADE", 0.24], ["GOODS", 0.16], ["SERVICES", 0.14], ["SALARY", 0.1], ["FAMILY", 0.09],
  ["INVEST", 0.08], ["LOAN", 0.06], ["ROYALTY", 0.04], ["TUITION", 0.05], ["DONATION", 0.04],
];

const CHANNELS: Array<[string, number]> = [
  ["SWIFT", 0.42], ["WIRE", 0.16], ["SEPA", 0.15], ["ACH", 0.12], ["LOCAL", 0.11], ["CARD", 0.04],
];

const INDIVIDUAL_FIRST = ["Amara", "Liam", "Sofia", "Chen", "Nadia", "Omar", "Elena", "Marcus", "Priya", "Hugo", "Ingrid", "Diego", "Yuki", "Kwame", "Farah", "Tomas", "Aisha", "Noah", "Lucia", "Rahul"];
const INDIVIDUAL_LAST = ["Okafor", "Nguyen", "Silva", "Rossi", "Haddad", "Kimani", "Novak", "Fischer", "Adeyemi", "Petrov", "Sharma", "Larsen", "Moreau", "Kaur", "Bianchi", "Yamada"];
const COMPANY_PREFIX = ["Northwind", "Meridian", "Atlas", "Kestrel", "Blue Harbour", "Ironbridge", "Solstice", "Vantor", "Lumen", "Cobalt", "Ardent", "Pinnacle", "Talos", "Quarry", "Aurelia", "Halcyon"];
const COMPANY_SUFFIX = ["Trading Ltd", "Logistics LLC", "Holdings BV", "Exports FZE", "Commodities Pte", "Consulting SA", "Partners LP", "Industries DMCC", "Capital Ltd", "Maritime Co"];

// ---------------------------------------------------------------- generation

function randomTimestamp(random: () => number, dayIndex: number): string {
  const dayStart = new Date(NOW.getTime() - (DAYS - dayIndex) * 86_400_000);
  const hour = pickWeighted(random, [
    [3, 0.04], [8, 0.14], [11, 0.18], [14, 0.2], [17, 0.2], [20, 0.14], [23, 0.1],
  ] as Array<[number, number]>);
  const minute = Math.floor(random() * 60);
  const date = new Date(dayStart);
  date.setUTCHours(hour, minute, 0, 0);
  const dayOfWeek = date.getUTCDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && random() > 0.25) {
    date.setUTCDate(date.getUTCDate() - 2);
  }
  return date.toISOString();
}

function generateOrg(organizationId: string, transactionCount: number, seed: number): GeneratedOrgData {
  const random = mulberry32(seed);
  const data: GeneratedOrgData = {
    entities: [],
    accounts: [],
    transactions: [],
    relations: new Map(),
    nomineeCounts: new Map(),
  };

  const entityCount = Math.round(transactionCount * 0.09);
  const nomineeNames = ["Marco Delgado Reyes", "Yusuf Karim", "Helena Voss", "Chen Wei", "Isabel Moreno", "Anton Petrov"];

  for (let index = 0; index < entityCount; index++) {
    const kind = pickWeighted(random, [["individual", 0.58], ["company", 0.36], ["intermediary", 0.06]] as Array<[SeedEntity["kind"], number]>);
    const country = pickWeighted(random, Object.entries(SENDER_WEIGHTS) as Array<[string, number]>);
    const isIndividual = kind === "individual";
    const legalName = isIndividual
      ? `${INDIVIDUAL_FIRST[Math.floor(random() * INDIVIDUAL_FIRST.length)]} ${INDIVIDUAL_LAST[Math.floor(random() * INDIVIDUAL_LAST.length)]}`
      : `${COMPANY_PREFIX[Math.floor(random() * COMPANY_PREFIX.length)]} ${COMPANY_SUFFIX[Math.floor(random() * COMPANY_SUFFIX.length)]}`;
    const sharedNominee = !isIndividual && random() < 0.12;
    const nominee = sharedNominee ? nomineeNames[Math.floor(random() * nomineeNames.length)]! : null;
    const sharedDevice = random() < 0.06 ? `device-${organizationId.slice(0, 4)}-${Math.floor(random() * 40)}` : null;

    data.entities.push({
      id: detId(`entity:${organizationId}:${index}`),
      organizationId,
      kind,
      legalName,
      country,
      incorporatedOn: isIndividual
        ? null
        : new Date(NOW.getTime() - Math.floor(365 * (1 + random() * 20)) * 86_400_000).toISOString().slice(0, 10),
      registrationNumber: isIndividual ? null : `REG-${organizationId.slice(0, 4)}-${index}`,
      pepFlag: random() < 0.015,
      nomineeDirectorName: nominee,
      metadata: sharedDevice ? { shared_device_id: sharedDevice } : {},
    });
    if (nominee) {
      data.nomineeCounts.set(nominee, (data.nomineeCounts.get(nominee) ?? 0) + 1);
    }
  }

  data.entities.forEach((value, entityIndex) => {
    const accountCount = 1 + (random() < 0.4 ? 1 : 0);
    for (let index = 0; index < accountCount; index++) {
      const openedAt = new Date(
        NOW.getTime() - Math.floor((random() < 0.1 ? random() * 120 : 400 + random() * 3200)) * 86_400_000,
      ).toISOString();
      data.accounts.push({
        id: detId(`account:${organizationId}:${entityIndex}:${index}`),
        organizationId,
        externalRef: `ACC-${organizationId.slice(0, 4).toUpperCase()}-${entityIndex}-${index}`,
        entityId: value.id,
        country: value.country,
        currency: currencyFor(value.country),
        status: random() < 0.02 ? "frozen" : "active",
        openedAt,
        riskTier: random() < 0.08 ? "high" : "low",
      });
    }
  });

  const entityById = new Map(data.entities.map((value) => [value.id, value]));
  const accountsByCountry = new Map<string, SeedAccount[]>();
  for (const value of data.accounts) {
    const list = accountsByCountry.get(value.country) ?? [];
    list.push(value);
    accountsByCountry.set(value.country, list);
  }

  const fallbackAccount = () => data.accounts[Math.floor(random() * data.accounts.length)]!;

  for (let index = 0; index < transactionCount; index++) {
    const [senderCountry, receiverCountry] = pickWeighted(
      random,
      CORRIDORS.map(([from, to, weight]) => [[from, to] as [string, string], weight] as [[string, string], number]),
    );
    const senderPool = accountsByCountry.get(senderCountry);
    const receiverPool = accountsByCountry.get(receiverCountry);
    const sender = senderPool && senderPool.length > 0 ? senderPool[Math.floor(random() * senderPool.length)]! : fallbackAccount();
    const receiver = receiverPool && receiverPool.length > 0 ? receiverPool[Math.floor(random() * receiverPool.length)]! : fallbackAccount();
    if (sender.id === receiver.id) continue;

    const amountBase = Math.min(1_500_000, Math.max(60, Math.exp(Math.log(3_200) + 1.15 * gaussian(random))));
    const currency = pickWeighted(random, [
      [sender.currency, 0.7],
      ["USD", 0.2],
      [receiver.currency, 0.1],
    ] as Array<[string, number]>);
    const rate = FX_TO_USD[currency] ?? 1;

    data.transactions.push({
      organizationId,
      id: detId(`tx:${organizationId}:${index}`),
      externalId: `SEED-${organizationId.slice(0, 4).toUpperCase()}-${String(index + 1).padStart(6, "0")}`,
      amount: Math.round((amountBase / rate) * 100) / 100,
      currency,
      amountBase: Math.round(amountBase * 100) / 100,
      senderAccountId: sender.id,
      receiverAccountId: receiver.id,
      senderName: entityById.get(sender.entityId)?.legalName ?? sender.externalRef,
      receiverName: entityById.get(receiver.entityId)?.legalName ?? receiver.externalRef,
      senderCountry,
      receiverCountry,
      channel: pickWeighted(random, CHANNELS),
      purposeCode: pickWeighted(random, PURPOSE_CODES),
      createdAt: randomTimestamp(random, Math.floor(random() * DAYS)),
    });
  }

  // Relationship graph: shared nominee director and shared device markers.
  const byNominee = new Map<string, SeedAccount[]>();
  const byDevice = new Map<string, SeedAccount[]>();
  for (const value of data.accounts) {
    const entity = data.entities.find((item) => item.id === value.entityId)!;
    if (entity.nomineeDirectorName) {
      const list = byNominee.get(entity.nomineeDirectorName) ?? [];
      list.push(value);
      byNominee.set(entity.nomineeDirectorName, list);
    }
    const device = entity.metadata.shared_device_id;
    if (device) {
      const list = byDevice.get(device) ?? [];
      list.push(value);
      byDevice.set(device, list);
    }
  }

  const linkGroup = (group: SeedAccount[]) => {
    if (group.length < 2 || group.length > 6) return;
    for (const source of group) {
      const set = data.relations.get(source.id) ?? new Set<string>();
      for (const target of group) {
        if (target.id !== source.id) set.add(target.id);
      }
      data.relations.set(source.id, set);
    }
  };
  byNominee.forEach(linkGroup);
  byDevice.forEach(linkGroup);

  return data;
}

function gaussian(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ------------------------------------------------------------------- scoring

function buildContext(data: GeneratedOrgData): { context: ScoringContext; sorted: SeedTransaction[] } {
  const entityById = new Map(data.entities.map((value) => [value.id, value]));
  const histories = new Map<string, AccountHistoryItem[]>();
  const transfers: TransferEdge[] = [];
  const sorted = [...data.transactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const tx of sorted) {
    const corridor = `${tx.senderCountry}-${tx.receiverCountry}`;
    const senderHistory = histories.get(tx.senderAccountId) ?? [];
    senderHistory.push({
      counterpartyId: tx.receiverAccountId,
      corridor,
      amountBase: tx.amountBase,
      createdAt: tx.createdAt,
      direction: "out",
      externalId: tx.externalId,
    });
    histories.set(tx.senderAccountId, senderHistory);

    const receiverHistory = histories.get(tx.receiverAccountId) ?? [];
    receiverHistory.push({
      counterpartyId: tx.senderAccountId,
      corridor,
      amountBase: tx.amountBase,
      createdAt: tx.createdAt,
      direction: "in",
      externalId: tx.externalId,
    });
    histories.set(tx.receiverAccountId, receiverHistory);

    transfers.push({
      fromAccountId: tx.senderAccountId,
      toAccountId: tx.receiverAccountId,
      amountBase: tx.amountBase,
      createdAt: tx.createdAt,
    });
  }

  const accounts: ScoringContext["accounts"] = {};
  for (const value of data.accounts) {
    const entity = entityById.get(value.entityId);
    accounts[value.id] = {
      id: value.id,
      entityId: value.entityId,
      entityName: entity?.legalName ?? value.externalRef,
      entityKind: entity?.kind ?? "individual",
      country: value.country,
      currency: value.currency,
      openedAt: value.openedAt,
      incorporatedOn: entity?.incorporatedOn ?? null,
      pepFlag: entity?.pepFlag ?? false,
      nomineeEntityCount: entity?.nomineeDirectorName
        ? Math.max(0, (data.nomineeCounts.get(entity.nomineeDirectorName) ?? 1) - 1)
        : 0,
      history: histories.get(value.id) ?? [],
    };
  }

  const relatedAccounts: Record<string, string[]> = {};
  data.relations.forEach((value, key) => {
    relatedAccounts[key] = [...value];
  });

  return {
    context: { accounts, recentTransfers: [], relatedAccounts, now: NOW.toISOString() },
    sorted,
  };
}

export interface ScoredTransaction extends SeedTransaction {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  riskFactors: unknown;
  summary: string;
  contributions: ReturnType<typeof scoreWithSignals>["contributions"];
}

function scoreAll(data: GeneratedOrgData): ScoredTransaction[] {
  const { context, sorted } = buildContext(data);

  // Rebuild the 72-hour edge window incrementally (two-pointer) so scoring stays linear.
  const windowMs = defaultRiskConfig.circularWindowHours * 3_600_000;
  const allEdges: TransferEdge[] = sorted.map((tx) => ({
    fromAccountId: tx.senderAccountId,
    toAccountId: tx.receiverAccountId,
    amountBase: tx.amountBase,
    createdAt: tx.createdAt,
  }));

  let startIndex = 0;
  const scored: ScoredTransaction[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const tx = sorted[index]!;
    const at = new Date(tx.createdAt).getTime();
    while (startIndex < allEdges.length && new Date(allEdges[startIndex]!.createdAt).getTime() < at - windowMs) {
      startIndex += 1;
    }
    context.recentTransfers = allEdges.slice(startIndex, index);

    const result = scoreWithSignals(tx, context, defaultRiskConfig);
    scored.push({
      ...tx,
      score: result.score,
      level: result.level,
      riskFactors: result.contributions.filter((item) => item.triggered),
      summary: result.explanation.summary,
      contributions: result.contributions,
    });
  }

  return scored;
}

// ------------------------------------------------------------------ insertion

function chunk<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

/** Runs an insert or upsert in batches and fails loudly on the first error. */
async function runBatched<Row>(
  label: string,
  rows: Row[],
  run: (batch: Row[]) => PromiseLike<{ error: { message: string } | null }>,
  chunkSize = 400,
): Promise<number> {
  if (rows.length === 0) return 0;
  let processed = 0;
  for (const batch of chunk(rows, chunkSize)) {
    const { error } = await run(batch);
    if (error) throw new Error(`${label}: ${error.message}`);
    processed += batch.length;
  }
  return processed;
}

function toEntityRows(data: GeneratedOrgData): TablesInsert<"entities">[] {
  return data.entities.map((value) => ({
    id: value.id,
    organization_id: value.organizationId,
    kind: value.kind,
    legal_name: value.legalName,
    country: value.country,
    incorporated_on: value.incorporatedOn,
    registration_number: value.registrationNumber,
    pep_flag: value.pepFlag,
    nominee_director_name: value.nomineeDirectorName,
    metadata: value.metadata,
  }));
}

function toAccountRows(data: GeneratedOrgData): TablesInsert<"accounts">[] {
  return data.accounts.map((value) => ({
    id: value.id,
    organization_id: value.organizationId,
    external_ref: value.externalRef,
    entity_id: value.entityId,
    country: value.country,
    currency: value.currency,
    status: value.status === "frozen" ? "frozen" : "active",
    opened_at: value.openedAt,
    risk_tier: value.riskTier,
  }));
}

function toTransactionRows(scored: ScoredTransaction[]): TablesInsert<"transactions">[] {
  const seen = new Set<string>();
  for (const value of scored) {
    const id = value.id ?? detId(`fallback:${value.externalId}`);
    if (seen.has(id)) {
      throw new Error(`Duplicate transaction id ${id} (${value.externalId})`);
    }
    seen.add(id);
  }
  return scored.map((value) => ({
    id: value.id ?? detId(`fallback:${value.externalId}`),
    organization_id: value.organizationId,
    external_id: value.externalId,
    sender_account_id: value.senderAccountId,
    receiver_account_id: value.receiverAccountId,
    sender_name: value.senderName,
    receiver_name: value.receiverName,
    amount: value.amount,
    currency: value.currency,
    amount_base: value.amountBase,
    sender_country: value.senderCountry,
    receiver_country: value.receiverCountry,
    channel: value.channel,
    purpose_code: value.purposeCode ?? null,
    status: "settled",
    risk_score: value.score,
    risk_level: value.level,
    // Simulated end-to-end detection latency: deterministic, 120-209 ms.
    score_ms: 120 + ((value.score * 7 + value.externalId.length * 3) % 90),
    risk_factors: toJson(value.riskFactors),
    scored_at: value.createdAt,
    model_version: defaultRiskConfig.modelVersion,
    created_at: value.createdAt,
  }));
}

function alertTitle(value: ScoredTransaction): string {
  const top = value.contributions.find((item) => item.triggered);
  const corridor = `${value.senderCountry}-${value.receiverCountry}`;
  if (top) {
    return `${top.label} on ${corridor} for ${value.senderName}`;
  }
  return `Elevated risk on ${corridor}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const started = Date.now();
  const client = createClient<Database>(url, key, { auth: { persistSession: false } });

  const signIn = async (email: string) => {
    const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  };

  console.log("Seeding SentinelFlow demo data…");
  await signIn("admin@northwind.example");

  const northwind = buildNorthwindDataset();

  console.log(
    `  generated ${northwind.transactions.length} transactions, ${northwind.accounts.length} accounts, ${northwind.entities.length} entities`,
  );

  const scoringStart = Date.now();
  const scored = scoreAll(northwind);
  console.log(`  scored ${scored.length} transactions in ${((Date.now() - scoringStart) / 1000).toFixed(1)}s`);

  await runBatched("entities", toEntityRows(northwind), (batch) =>
    client.from("entities").upsert(batch, { onConflict: "id" }),
  );
  await runBatched("accounts", toAccountRows(northwind), (batch) =>
    client.from("accounts").upsert(batch, { onConflict: "id" }),
  );
  await runBatched(
    "transactions",
    toTransactionRows(scored),
    (batch) => client.from("transactions").upsert(batch, { onConflict: "organization_id,external_id" }),
    500,
  );

  // Alerts for anything at or above the configured cutoff.
  const flagged = scored.filter((value) => value.score >= SCORE_BANDS.alert);
  const existingAlerts = new Set<string>();
  for (const batch of chunk(flagged, 200)) {
    const ids = batch.map((value) => value.id!).filter(Boolean);
    const { data, error } = await client
      .from("alerts")
      .select("transaction_id")
      .eq("organization_id", ORG_NORTHWIND)
      .in("transaction_id", ids);
    if (error) throw new Error(`alerts lookup: ${error.message}`);
    (data ?? []).forEach((row) => existingAlerts.add(row.transaction_id));
  }

  const alertRows: TablesInsert<"alerts">[] = flagged
    .filter((value) => value.id && !existingAlerts.has(value.id))
    .map((value) => ({
      organization_id: ORG_NORTHWIND,
      transaction_id: value.id!,
      title: alertTitle(value),
      severity: value.level,
      status: "new" as const,
      summary: value.summary,        score_snapshot: toJson({
          score: value.score,
          level: value.level,
          model: "rule_based",
          modelVersion: defaultRiskConfig.modelVersion,
          summary: value.summary,
          contributions: value.contributions.slice(0, 6).map((item) => ({
            id: item.id,
            label: item.label,
            points: Math.round(item.points * 10) / 10,
            raw: item.raw,
            triggered: item.triggered,
            facts: item.facts,
            narrative: item.narrative,
          })),
        }),
    }));

  await runBatched("alerts", alertRows, (batch) => client.from("alerts").insert(batch), 200);

  const plantedCoverage = new Map<string, number>();
  for (const value of flagged) {
    if (!value.planted) continue;
    const key = value.planted.replace(/_\d+$/, "");
    plantedCoverage.set(key, (plantedCoverage.get(key) ?? 0) + 1);
  }

  // Rules -------------------------------------------------------------------
  const existingRules = await client
    .from("rules")
    .select("id, name")
    .eq("organization_id", ORG_NORTHWIND);
  const existingRuleNames = new Set((existingRules.data ?? []).map((row) => row.name));

  for (const rule of seedRules) {
    if (existingRuleNames.has(rule.name)) continue;
    const ruleId = detId(`rule:${ORG_NORTHWIND}:${rule.name}`);
    await runBatched(
      "rules",
      [
        {
          id: ruleId,
          organization_id: ORG_NORTHWIND,
          name: rule.name,
          description: rule.description,
          status: rule.status,
          created_by: ADMIN_NORTHWIND,
        },
      ],
      (batch) => client.from("rules").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
    );

    const publishedVersionId = detId(`rule-version:${ruleId}:1`);
    await runBatched(
      "rule_versions",
      [
        {
          id: publishedVersionId,
          rule_id: ruleId,
          version: 1,
          definition: toJson(rule.definition),
          definition_hash: definitionHash(rule.definition),
          is_draft: rule.status === "draft",
          published_at: rule.status === "draft" ? null : new Date().toISOString(),
          published_by: rule.status === "draft" ? null : ADMIN_NORTHWIND,
          change_note: rule.changeNote,
          created_by: ADMIN_NORTHWIND,
        },
      ],
      (batch) =>
        client.from("rule_versions").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
    );

    if (rule.status === "active") {
      await runBatched(
        "rule_versions",
        [
          {
            id: detId(`rule-version:${ruleId}:2`),
            rule_id: ruleId,
            version: 2,
            definition: toJson(rule.definition),
            definition_hash: definitionHash(rule.definition),
            is_draft: true,
            change_note: "Draft created automatically after publishing version 1.",
            created_by: ADMIN_NORTHWIND,
          },
        ],
        (batch) =>
          client.from("rule_versions").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
      );

      await client
        .from("rules")
        .update({ current_version_id: publishedVersionId, status: "active" })
        .eq("id", ruleId);
    }
  }

  // Case management ---------------------------------------------------------
  const { data: topAlerts, error: topAlertsError } = await client
    .from("alerts")
    .select("id, title, severity, status, summary")
    .eq("organization_id", ORG_NORTHWIND)
    .order("created_at", { ascending: false })
    .limit(8);
  if (topAlertsError) throw new Error(`alerts read: ${topAlertsError.message}`);

  if ((topAlerts ?? []).length >= 3) {
    const caseId = detId(`case:${ORG_NORTHWIND}:1`);
    const { data: existingCase } = await client.from("cases").select("id").eq("id", caseId).maybeSingle();
    if (!existingCase) {
      await runBatched(
        "cases",
        [
          {
            id: caseId,
            organization_id: ORG_NORTHWIND,
            title: "Structuring cluster on the PK-MM corridor",
            status: "in_review" as const,
            priority: "critical" as const,
            owner_id: ANALYST_NORTHWIND,
            summary:
              "Seven sub-threshold transfers from two related accounts share a device fingerprint and settle inside 22 hours with a recently incorporated intermediary.",
            created_from_alert_id: topAlerts![0]!.id,
          },
        ],
        (batch) => client.from("cases").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
      );

      // Notes are RLS-bound to their author, so each demo author writes their own.
      await signIn("analyst1@northwind.example");
      await runBatched(
        "case_notes",
        [
          {
            id: detId(`case-note:${caseId}:1`),
            case_id: caseId,
            author_id: ANALYST_NORTHWIND,
            body:
              "Requested the device fingerprint history for both sending accounts and the beneficiary's incorporation documents. Pass-through ratio is 96% within four hours.",
          },
        ],
        (batch) => client.from("case_notes").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
      );

      await signIn("admin@northwind.example");
      await runBatched(
        "case_notes",
        [
          {
            id: detId(`case-note:${caseId}:2`),
            case_id: caseId,
            author_id: ADMIN_NORTHWIND,
            body: "Escalating to the MLRO with the SAR-style summary attached. Draft report generated for review.",
          },
        ],
        (batch) => client.from("case_notes").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
      );

      await runBatched(
        "case_alerts",
        topAlerts!.slice(0, 5).map((alert) => ({ case_id: caseId, alert_id: alert.id })),
        (batch) =>
          client
            .from("case_alerts")
            .upsert(batch, { onConflict: "case_id,alert_id", ignoreDuplicates: true }),
      );

      await runBatched(
        "alert_events",
        topAlerts!.map((alert, index) => ({
          id: detId(`alert-event:${caseId}:${alert.id}`),
          alert_id: alert.id,
          actor_id: index % 2 === 0 ? ANALYST_NORTHWIND : ADMIN_NORTHWIND,
          event_type: "note_added" as const,
          payload: {
            note: `Investigation note ${index + 1}: corroborated the alert summary against the linked case.`,
          },
        })),
        (batch) =>
          client.from("alert_events").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
      );
    }

    // Digests are opt-in: the schedule exists but stays disabled until an admin turns it on.
    await runBatched(
      "report_schedules",
      [
        {
          id: detId(`schedule:${ORG_NORTHWIND}`),
          organization_id: ORG_NORTHWIND,
          kind: "daily_digest" as const,
          format: "pdf" as const,
          send_at: "07:30",
          timezone: "Europe/London",
          recipients: ["compliance@northwind.example"],
          enabled: false,
          created_by: ADMIN_NORTHWIND,
        },
      ],
      (batch) =>
        client.from("report_schedules").upsert(batch, { onConflict: "id", ignoreDuplicates: true }),
    );
  }

  // Second tenant ------------------------------------------------------------
  await signIn("admin@meridian.example");
  const meridian = generateOrg(ORG_MERIDIAN, 2_000, 4242);
  const scoredMeridian = scoreAll(meridian);
  await runBatched("entities", toEntityRows(meridian), (batch) =>
    client.from("entities").upsert(batch, { onConflict: "id" }),
  );
  await runBatched("accounts", toAccountRows(meridian), (batch) =>
    client.from("accounts").upsert(batch, { onConflict: "id" }),
  );
  await runBatched(
    "transactions",
    toTransactionRows(scoredMeridian),
    (batch) => client.from("transactions").upsert(batch, { onConflict: "organization_id,external_id" }),
    500,
  );

  const meridianAlerts: TablesInsert<"alerts">[] = scoredMeridian
    .filter((value) => value.score >= SCORE_BANDS.alert)
    .map((value) => ({
      organization_id: ORG_MERIDIAN,
      transaction_id: value.id!,
      title: alertTitle(value),
      severity: value.level,
      status: "new" as const,
      assignee_id: ANALYST_MERIDIAN,
      summary: value.summary,
      score_snapshot: toJson({
        score: value.score,
        level: value.level,
        model: "rule_based",
        modelVersion: defaultRiskConfig.modelVersion,
        summary: value.summary,
      }),
    }));

  // Alerts are unique per transaction, so skip anything already recorded.
  const existingMeridianAlerts = new Set<string>();
  for (const batch of chunk(meridianAlerts, 200)) {
    const ids = batch.map((row) => row.transaction_id).filter((id): id is string => Boolean(id));
    const { data, error } = await client
      .from("alerts")
      .select("transaction_id")
      .eq("organization_id", ORG_MERIDIAN)
      .in("transaction_id", ids);
    if (error) throw new Error(`alerts lookup: ${error.message}`);
    (data ?? []).forEach((row) => existingMeridianAlerts.add(row.transaction_id));
  }

  await runBatched(
    "alerts",
    meridianAlerts.filter((row) => !row.transaction_id || !existingMeridianAlerts.has(row.transaction_id)),
    (batch) => client.from("alerts").insert(batch),
    200,
  );


  const coverage = [...plantedCoverage.entries()]
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");

  console.log("\nDemo accounts (password: Sentinel-Demo-2026!)");
  console.log("  admin@northwind.example      Northwind Payments · admin");
  console.log("  analyst1@northwind.example   Northwind Payments · analyst");
  console.log("  analyst2@northwind.example   Northwind Payments · analyst");
  console.log("  viewer@northwind.example     Northwind Payments · viewer");
  console.log("  admin@meridian.example       Meridian Trust Bank · admin");
  console.log("  analyst1@meridian.example    Meridian Trust Bank · analyst");
  console.log("\nPlanted patterns flagged above the cutoff:");
  console.log(`  ${coverage || "none"}`);
  console.log(`  alerts created: ${alertRows.length} (northwind) + ${meridianAlerts.length} (meridian)`);
  console.log(`  flagged transactions: ${flagged.length} of ${scored.length}`);
  console.log(`\nSeed finished in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

export function buildNorthwindDataset(): GeneratedOrgData {
  const northwind = generateOrg(ORG_NORTHWIND, 10_000, 20260630);
  addPlantedPatterns({
    organizationId: ORG_NORTHWIND,
    data: northwind,
    partnerAccounts: northwind.accounts.slice(0, 60),
  });
  return northwind;
}

/** Exposed for integration tests: scores a dataset with the production engine. */
export function scoreDataset(data: GeneratedOrgData): ScoredTransaction[] {
  return scoreAll(data);
}

// Vitest imports this module for the planted-pattern integration test; only the
// CLI entrypoint should touch the network.
if (!process.env.VITEST) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
