import { currencyCountryMap, SCORE_BANDS, scoreToLevel } from "@/config/risk";
import { MAX_DEMO_DAYS, MAX_DEMO_PAYMENTS } from "@/lib/demo/presets";
import { defaultRiskConfig } from "@/lib/risk/config";
import { scoreWithSignals } from "@/lib/risk/engine";
import type {
  AccountContext,
  AccountHistoryItem,
  RiskTransaction,
  ScoringContext,
  TransferEdge,
} from "@/lib/risk/types";

/**
 * Synthetic-but-coherent workspace data.
 *
 * The point of this generator is not volume. It is that every row is scored by
 * the same engine and against the same accumulating history a real feed would
 * have, so velocity, splitting, circularity and pass-through have something
 * real to compare against instead of a brand-new account with no past.
 * Payments keep their historical timestamps, which is what makes the trailing
 * baselines and the analyst's history usable.
 */

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const MS_MINUTE = 60_000;

export { DEMO_PRESETS, MAX_DEMO_DAYS, MAX_DEMO_PAYMENTS } from "@/lib/demo/presets";
export type { DemoPreset } from "@/lib/demo/presets";

type RiskLevelDb = "low" | "medium" | "high" | "critical";

export interface DemoEntityRow {
  id: string;
  organization_id: string;
  kind: "individual" | "company" | "intermediary";
  legal_name: string;
  country: string;
  incorporated_on: string | null;
  registration_number: string | null;
  pep_flag: boolean;
  nominee_director_name: string | null;
  metadata: Record<string, unknown>;
}

export interface DemoAccountRow {
  id: string;
  organization_id: string;
  external_ref: string;
  entity_id: string;
  country: string;
  currency: string;
  status: "active";
  opened_at: string;
  risk_tier: RiskLevelDb;
}

export interface DemoTransactionRow {
  id: string;
  organization_id: string;
  external_id: string;
  sender_account_id: string;
  receiver_account_id: string;
  sender_name: string;
  receiver_name: string;
  amount: number;
  currency: string;
  amount_base: number;
  sender_country: string;
  receiver_country: string;
  channel: string;
  purpose_code: string;
  status: "settled";
  risk_score: number;
  risk_level: RiskLevelDb;
  score_ms: number;
  risk_factors: Array<Record<string, unknown>>;
  scored_at: string;
  model_version: string;
  created_at: string;
}

export interface DemoAlertRow {
  organization_id: string;
  transaction_id: string;
  title: string;
  severity: RiskLevelDb;
  status: "new";
  due_at: string;
  first_seen_at: string;
  summary: string;
  score_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface DemoDataset {
  entities: DemoEntityRow[];
  accounts: DemoAccountRow[];
  transactions: DemoTransactionRow[];
  alerts: DemoAlertRow[];
  summary: {
    payments: number;
    flagged: number;
    alerts: number;
    entities: number;
    accounts: number;
    days: number;
    from: string;
    to: string;
    averageScore: number;
  };
}

export interface DemoOptions {
  organizationId: string;
  payments: number;
  days: number;
  seed?: number;
  typologies?: boolean;
  now?: Date;
}

/* -------------------------------------------------------------------------- */
/* Deterministic randomness                                                    */
/* -------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/* -------------------------------------------------------------------------- */
/* Reference data                                                              */
/* -------------------------------------------------------------------------- */

const COUNTRY_WEIGHTS: Array<[string, number]> = [
  ["US", 16], ["GB", 13], ["DE", 9], ["NL", 5], ["FR", 5], ["SG", 8], ["AE", 7],
  ["IN", 8], ["CN", 5], ["JP", 4], ["AU", 4], ["CA", 4], ["CH", 3], ["HK", 3],
  ["BR", 3], ["ZA", 2], ["NG", 2], ["KE", 1], ["TR", 2], ["MX", 2], ["PK", 1],
  ["MY", 2], ["TH", 1], ["ID", 1], ["PH", 1], ["RU", 1], ["IR", 1], ["MM", 1],
];

/** Plausible destinations for a sender's jurisdiction, so corridors repeat. */
const PARTNERS: Record<string, string[]> = {
  US: ["MX", "CA", "GB", "CN", "IN", "BR"],
  GB: ["NG", "KE", "DE", "US", "IN", "AE"],
  DE: ["TR", "NL", "FR", "GB", "CN", "US"],
  NL: ["DE", "GB", "US", "SG", "ID"],
  FR: ["DE", "GB", "US", "AE", "MX"],
  SG: ["MY", "ID", "TH", "IN", "AU", "HK"],
  AE: ["IN", "PK", "IR", "GB", "PH"],
  IN: ["AE", "US", "GB", "SG", "MY"],
  CN: ["HK", "SG", "US", "DE", "GB"],
  JP: ["US", "CN", "SG", "TH"],
  AU: ["SG", "CN", "US", "ID"],
  CA: ["US", "GB", "CN", "IN"],
  CH: ["DE", "GB", "US", "TR"],
  HK: ["CN", "SG", "US", "GB"],
  BR: ["US", "GB", "MX"],
  ZA: ["GB", "NG", "US", "KE"],
  NG: ["GB", "US", "KE", "ZA"],
  KE: ["GB", "AE", "US"],
  TR: ["DE", "AE", "GB", "IR"],
  MX: ["US", "BR"],
  PK: ["AE", "GB", "US"],
  MY: ["SG", "ID", "TH", "CN"],
  TH: ["SG", "MY", "US"],
  ID: ["SG", "MY", "AU"],
  PH: ["AE", "SG", "US"],
  RU: ["AE", "TR", "CN"],
  IR: ["AE", "TR", "MM"],
  MM: ["TH", "SG", "CN"],
};

const FIRST_NAMES = [
  "Amara", "Liam", "Sofia", "Noah", "Priya", "Mateo", "Yuki", "Omar", "Elena",
  "Kwame", "Ingrid", "Rahul", "Chen", "Nadia", "Tomas", "Aisha", "Diego",
  "Hana", "Lars", "Mei", "Jonas", "Fatima", "Andre", "Leila", "Hugo", "Anika",
  "Samir", "Clara", "Tariq", "Noor", "Felix", "Zara", "Marco", "Iris", "Kofi",
];

const LAST_NAMES = [
  "Rossi", "Fischer", "Novak", "Yamada", "Kaur", "Bianchi", "Silva", "Okafor",
  "Lindqvist", "Kimani", "Delgado", "Haddad", "Nakamura", "Petrov", "Mensah",
  "Costa", "Alvarez", "Bauer", "Hoffmann", "Ibrahim", "Marchetti", "Osei",
  "Rahman", "Sato", "Varga", "Weber", "Zhang", "Andersen", "Bakshi", "Diallo",
];

const COMPANY_HEADS = [
  "Ardent", "Vantor", "Solstice", "Caspian", "Halcyon", "Atlas", "Meridian",
  "Northgate", "Silverline", "Bridgepoint", "Pinnacle", "Talos", "Ormuz",
  "Blue Harbour", "Lumen", "Aurelia", "Zagros", "Cobalt", "Kestrel", "Damascus",
  "Bakhtaran", "Volga", "Horizon", "Ridgeway", "Alder",
];

const COMPANY_TAILS = ["Trade", "Commodities", "Logistics", "Marine Services", "Holdings", "Exports", "Metals", "Transit"];
const COMPANY_FORMS = ["Ltd", "FZE", "DMCC", "Pte", "BV", "SA", "LLC", "GmbH"];

const PURPOSE_CODES = ["TRADE", "SERVICES", "INVOICE", "LOAN", "PAYROLL", "TRANSFER", "ROYALTY"];
const CHANNELS = ["swift", "sepa", "ach", "wire", "local"];

/** Static reference rates: the demo needs believable local amounts, not FX accuracy. */
const RATES: Record<string, number> = {
  USD: 1, GBP: 0.79, EUR: 0.92, INR: 83.2, AED: 3.67, SGD: 1.34, JPY: 157,
  CNY: 7.2, BRL: 5.4, CHF: 0.9, AUD: 1.5, CAD: 1.37, HKD: 7.8, ZAR: 18.4,
  NGN: 1_500, KES: 129, TRY: 32, MXN: 17, PKR: 278, MYR: 4.7, THB: 36,
  IDR: 16_000, PHP: 57, RUB: 90, IRR: 42_000, MMK: 2_100,
};


/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Run-scoped id: the token keeps repeat generations from colliding on primary keys. */
function uuid(index: number, salt: number, token: number): string {
  const mixed = (Math.imul(index + 1, 2_654_435_761) + Math.imul(salt + 1, 40_503) + token) >>> 0;
  const noise = mixed.toString(16).padStart(8, "0") + (salt % 65_536).toString(16).padStart(4, "0");
  // 8-4-4-4-12, the shape Postgres requires for uuid columns.
  return `d3${(token % 0x1000000).toString(16).padStart(6, "0")}-0000-4000-8000-${noise}`;
}

export function buildDemoDataset(options: DemoOptions): DemoDataset {
  const now = options.now ?? new Date();
  const payments = Math.min(MAX_DEMO_PAYMENTS, Math.max(20, Math.round(options.payments)));
  const days = Math.min(MAX_DEMO_DAYS, Math.max(1, Math.round(options.days)));
  const seed = options.seed ?? 20261019;
  const withTypologies = options.typologies ?? true;
  const token = seed >>> 0;
  // Generation is additive, so account and registration references carry a
  // per-run tag. Without it a second run collides with the first on the
  // (organization_id, external_ref) and registration-number uniques.
  const runTag = token.toString(36).toUpperCase().padStart(6, "0");
  const random = mulberry32(seed);
  const organizationId = options.organizationId;

  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const weightedCountry = (): string => {
    const total = COUNTRY_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;
    for (const [country, weight] of COUNTRY_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return country;
    }
    return "US";
  };
  const partnerFor = (country: string): string => (PARTNERS[country] ? pick(PARTNERS[country]!) : weightedCountry());
  const nameFor = (kind: DemoEntityRow["kind"]): string => {
    if (kind === "individual") return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    return `${pick(COMPANY_HEADS)} ${pick(COMPANY_TAILS)} ${pick(COMPANY_FORMS)}`;
  };

  /* ---------------------------------------------------------------- entities */

  const entities: DemoEntityRow[] = [];
  const accounts: DemoAccountRow[] = [];
  const nomineeNames = ["Marco Delgado Reyes", "Yusuf Al-Rashid", "Petra Lindholm", "Chen Wei"];

  const addEntity = (input: {
    kind: DemoEntityRow["kind"];
    country: string;
    legalName?: string;
    pep?: boolean;
    nominee?: string | null;
    ageDays?: number;
    sharedDevice?: string | null;
    accounts?: number;
  }): DemoAccountRow[] => {
    const index = entities.length;
    const id = uuid(index, 7, token);
    const ageDays = input.ageDays ?? 400 + Math.floor(random() * 3_000);
    entities.push({
      id,
      organization_id: organizationId,
      kind: input.kind,
      legal_name: input.legalName ?? nameFor(input.kind),
      country: input.country,
      incorporated_on:
        input.kind === "individual" ? null : new Date(now.getTime() - ageDays * MS_DAY).toISOString().slice(0, 10),
      registration_number: input.kind === "individual" ? null : `REG-${input.country}-${runTag}-${1_000 + index}`,
      pep_flag: input.pep ?? false,
      nominee_director_name: input.nominee ?? null,
      metadata: {
        demo: true,
        ...(input.sharedDevice ? { shared_device_id: input.sharedDevice } : {}),
      },
    });

    const created: DemoAccountRow[] = [];
    const count = input.accounts ?? 1;
    for (let accountIndex = 0; accountIndex < count; accountIndex += 1) {
      const account: DemoAccountRow = {
        id: uuid(index * 2 + accountIndex, 11, token),
        organization_id: organizationId,
        external_ref: `ACC-${input.country}-${runTag}-${String(index + 1).padStart(3, "0")}${accountIndex ? "-B" : ""}`,
        entity_id: id,
        country: input.country,
        currency: currencyForCountry(input.country),
        status: "active",
        opened_at: new Date(now.getTime() - (30 + Math.floor(random() * 1_600)) * MS_DAY).toISOString(),
        risk_tier: input.pep ? "critical" : input.nominee ? "high" : "low",
      };
      accounts.push(account);
      created.push(account);
    }
    return created;
  };

  const entityCount = Math.max(18, Math.min(84, Math.round(payments / 14)));
  for (let index = 0; index < entityCount; index += 1) {
    const roll = random();
    const kind: DemoEntityRow["kind"] = roll < 0.64 ? "individual" : roll < 0.93 ? "company" : "intermediary";
    addEntity({
      kind,
      country: weightedCountry(),
      pep: random() < 0.035,
      nominee: kind !== "individual" && random() < 0.09 ? pick(nomineeNames) : null,
      sharedDevice: kind === "individual" && random() < 0.18 ? `device-${Math.floor(random() * 4) + 1}` : null,
      accounts: kind === "company" && random() < 0.35 ? 2 : 1,
    });
  }

  /* ------------------------------------------------------- planted typologies */

  interface PlantedCluster {
    senders: DemoAccountRow[];
    pepBeneficiary: DemoAccountRow;
    ring: DemoAccountRow[];
    shell: DemoAccountRow;
    shellFunder: DemoAccountRow;
    shellBeneficiary: DemoAccountRow;
  }

  // Larger datasets get several clusters, so the queue looks like a queue.
  const clusterCount = withTypologies ? Math.min(4, Math.max(1, Math.round(payments / 650))) : 0;
  const ringCountries = [
    ["MM", "IR", "RU"],
    ["IR", "RU", "MM"],
    ["RU", "MM", "IR"],
    ["MM", "RU", "IR"],
  ] as const;
  const clusters: PlantedCluster[] = [];

  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    // Three individuals on one device split payments toward a PEP in a
    // critical jurisdiction: splitting + corridor + PEP + new counterparty.
    const senders = [0, 1, 2].flatMap(() =>
      addEntity({
        kind: "individual",
        country: "AE",
        sharedDevice: `device-structured-${cluster}`,
      }),
    );
    const pepBeneficiary = addEntity({
      kind: "company",
      country: "IR",
      legalName: `${["Caspian Union Trade", "Ormuz Logistics", "Zagros Holdings", "Bakhtaran Trading"][cluster]!} FZE`,
      pep: true,
      nominee: "Marco Delgado Reyes",
      ageDays: 60,
    })[0]!;
    // Three young companies return value around a loop.
    const ring = ringCountries[cluster]!.flatMap((country, index) =>
      addEntity({
        kind: "company",
        country,
        nominee: "Yusuf Al-Rashid",
        ageDays: 35 + index * 4,
      }),
    );
    // One shell forwards almost everything it receives within hours.
    const shell = addEntity({
      kind: "intermediary",
      country: "IR",
      nominee: "Petra Lindholm",
      ageDays: 40,
    })[0]!;
    const shellFunder = addEntity({ kind: "company", country: "AE", ageDays: 900 })[0]!;
    const shellBeneficiary = addEntity({ kind: "company", country: "MM", ageDays: 700 })[0]!;
    clusters.push({ senders, pepBeneficiary, ring, shell, shellFunder, shellBeneficiary });
  }

  /* ------------------------------------------------------------ housekeeping */

  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const accountsByEntity = new Map<string, DemoAccountRow[]>();
  for (const account of accounts) {
    const list = accountsByEntity.get(account.entity_id) ?? [];
    list.push(account);
    accountsByEntity.set(account.entity_id, list);
  }

  const nomineeCounts = new Map<string, number>();
  for (const entity of entities) {
    if (!entity.nominee_director_name) continue;
    nomineeCounts.set(entity.nominee_director_name, (nomineeCounts.get(entity.nominee_director_name) ?? 0) + 1);
  }

  const deviceGroups = new Map<string, string[]>();
  for (const entity of entities) {
    const device = entity.metadata.shared_device_id;
    if (typeof device !== "string") continue;
    const list = deviceGroups.get(device) ?? [];
    for (const account of accountsByEntity.get(entity.id) ?? []) list.push(account.id);
    deviceGroups.set(device, list);
  }

  const relatedAccounts = new Map<string, string[]>();
  for (const account of accounts) {
    const related = new Set<string>();
    for (const sibling of accountsByEntity.get(account.entity_id) ?? []) {
      if (sibling.id !== account.id) related.add(sibling.id);
    }
    const entity = entityById.get(account.entity_id)!;
    const device = entity.metadata.shared_device_id;
    if (typeof device === "string") {
      for (const other of deviceGroups.get(device) ?? []) if (other !== account.id) related.add(other);
    }
    if (entity.nominee_director_name) {
      for (const peer of entities) {
        if (peer.id === entity.id || peer.nominee_director_name !== entity.nominee_director_name) continue;
        for (const peerAccount of accountsByEntity.get(peer.id) ?? []) related.add(peerAccount.id);
      }
    }
    if (related.size > 0) relatedAccounts.set(account.id, [...related]);
  }

  /* ------------------------------------------------------------ transactions */

  interface Draft {
    externalId: string;
    sender: DemoAccountRow;
    receiver: DemoAccountRow;
    amountBase: number;
    currency: string;
    createdAt: number;
    purpose: string;
    channel: string;
  }

  const drafts: Draft[] = [];
  const counterpartyMemory = new Map<string, string[]>();

  const addDraft = (
    sender: DemoAccountRow,
    receiver: DemoAccountRow,
    amountBase: number,
    createdAt: number,
    options: { currency?: string; purpose?: string; channel?: string } = {},
  ) => {
    drafts.push({
      externalId: `DEMO-${seed.toString(36).toUpperCase()}-${String(drafts.length + 1).padStart(5, "0")}`,
      sender,
      receiver,
      amountBase: Math.max(12, round2(amountBase)),
      currency: options.currency ?? sender.currency,
      createdAt,
      purpose: options.purpose ?? pick(PURPOSE_CODES),
      channel: options.channel ?? pick(CHANNELS),
    });
    const memory = counterpartyMemory.get(sender.id) ?? [];
    memory.push(receiver.id);
    counterpartyMemory.set(sender.id, memory);
  };

  const receiverFor = (sender: DemoAccountRow): DemoAccountRow => {
    const familiar = counterpartyMemory.get(sender.id) ?? [];
    if (familiar.length >= 2 && random() < 0.62) {
      const accountId = pick(familiar);
      const match = accounts.find((account) => account.id === accountId);
      if (match) return match;
    }
    const preferred = partnerFor(sender.country);
    const candidates = accounts.filter((account) => account.id !== sender.id && account.country === preferred);
    if (candidates.length > 0) return pick(candidates);
    return pick(accounts.filter((account) => account.id !== sender.id));
  };

  clusters.forEach((cluster, clusterIndex) => {
    const start = now.getTime() - (9 + clusterIndex * 3) * MS_DAY;

    // Splitting: nine sub-threshold tranches across three related accounts.
    for (let index = 0; index < 9; index += 1) {
      const sender = cluster.senders[index % cluster.senders.length]!;
      addDraft(sender, cluster.pepBeneficiary, 9_250 + random() * 450, start + index * 2.4 * MS_HOUR, {
        currency: "USD",
        purpose: "SERVICES",
        channel: "sepa",
      });
    }

    // Circular flow: value returns to the origin inside 45 minutes.
    const ringStart = now.getTime() - (4 + clusterIndex) * MS_DAY;
    const legs: Array<[number, number, number]> = [
      [0, 1, 124_000],
      [1, 2, 121_500],
      [2, 0, 119_000],
    ];
    for (const [from, to, amount] of legs) {
      addDraft(cluster.ring[from]!, cluster.ring[to]!, amount, ringStart + from * 15 * MS_MINUTE, {
        currency: "USD",
        purpose: "LOAN",
        channel: "wire",
      });
    }

    // Pass-through: inbound value is forwarded in four tranches within hours.
    const shellStart = now.getTime() - (3 + clusterIndex * 2) * MS_DAY;
    addDraft(cluster.shellFunder, cluster.shell, 212_000, shellStart, {
      currency: "USD",
      purpose: "TRADE",
      channel: "swift",
    });
    for (let index = 0; index < 4; index += 1) {
      addDraft(cluster.shell, cluster.shellBeneficiary, 51_000, shellStart + (index + 1) * MS_HOUR, {
        currency: "USD",
        purpose: "TRADE",
        channel: "swift",
      });
    }
  });

  // Typology rows are part of the requested total, not extra on top of it.
  const normalTarget = Math.max(0, payments - drafts.length);
  for (let created = 0; created < normalTarget; created += 1) {
    const sender = pick(accounts);
    const receiver = receiverFor(sender);
    // Skew toward recent days so the newest buckets are not empty, then prefer
    // weekdays over weekends without ever falling short of the target.
    let ageDays = Math.floor(Math.pow(random(), 1.7) * days);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const weekday = new Date(now.getTime() - ageDays * MS_DAY).getUTCDay();
      if (weekday !== 0 && weekday !== 6) break;
      ageDays = Math.floor(Math.pow(random(), 1.7) * days);
    }
    const hour = 6 + Math.floor(Math.pow(random(), 0.9) * 15);
    const createdAt = now.getTime() - ageDays * MS_DAY - (23 - hour) * MS_HOUR - Math.floor(random() * 59) * MS_MINUTE;
    const roll = random();
    const amountBase =
      roll < 0.86
        ? 180 + Math.pow(random(), 2.2) * 7_200
        : roll < 0.96
          ? 8_900 + random() * 1_300
          : 12_000 + random() * 90_000;
    addDraft(sender, receiver, amountBase, createdAt);
  }

  drafts.sort((a, b) => a.createdAt - b.createdAt);

  /* ----------------------------------------------------------------- scoring */

  const history = new Map<string, AccountHistoryItem[]>();
  for (const account of accounts) history.set(account.id, []);

  const contexts = new Map<string, AccountContext>();
  for (const account of accounts) {
    const entity = entityById.get(account.entity_id)!;
    contexts.set(account.id, {
      id: account.id,
      entityId: entity.id,
      entityName: entity.legal_name,
      entityKind: entity.kind,
      country: account.country,
      currency: account.currency,
      openedAt: account.opened_at,
      incorporatedOn: entity.incorporated_on,
      pepFlag: entity.pep_flag,
      nomineeEntityCount: entity.nominee_director_name
        ? nomineeCounts.get(entity.nominee_director_name) ?? 0
        : 0,
      history: history.get(account.id)!,
    });
  }

  const accountsRecord = Object.fromEntries(contexts);
  const recentTransfers: TransferEdge[] = [];
  const transactions: DemoTransactionRow[] = [];

  for (const draft of drafts) {
    const senderEntity = entityById.get(draft.sender.entity_id)!;
    const receiverEntity = entityById.get(draft.receiver.entity_id)!;
    const createdAt = new Date(draft.createdAt).toISOString();
    const riskTransaction: RiskTransaction = {
      externalId: draft.externalId,
      amount: round2(draft.amountBase * (RATES[draft.currency] ?? 1)),
      currency: draft.currency,
      amountBase: draft.amountBase,
      senderAccountId: draft.sender.id,
      receiverAccountId: draft.receiver.id,
      senderName: senderEntity.legal_name,
      receiverName: receiverEntity.legal_name,
      senderCountry: draft.sender.country,
      receiverCountry: draft.receiver.country,
      channel: draft.channel,
      purposeCode: draft.purpose,
      createdAt,
    };

    // Older edges leave the 72-hour circularity window before scoring.
    const cutoff = draft.createdAt - 72 * MS_HOUR;
    while (recentTransfers.length > 0 && new Date(recentTransfers[0]!.createdAt).getTime() < cutoff) {
      recentTransfers.shift();
    }

    const context: ScoringContext = {
      accounts: accountsRecord,
      recentTransfers: [...recentTransfers],
      relatedAccounts: Object.fromEntries(relatedAccounts),
      now: createdAt,
    };

    const result = scoreWithSignals(riskTransaction, context, defaultRiskConfig);
    const riskFactors = result.contributions.slice(0, 5).map((contribution) => ({
      id: contribution.id,
      label: contribution.label,
      points: Math.round(contribution.points * 10) / 10,
      weight: contribution.weight,
      raw: contribution.raw,
      triggered: contribution.triggered,
      narrative: contribution.narrative,
      facts: contribution.facts,
    }));

    transactions.push({
      id: uuid(transactions.length, 23, token),
      organization_id: organizationId,
      external_id: draft.externalId,
      sender_account_id: draft.sender.id,
      receiver_account_id: draft.receiver.id,
      sender_name: senderEntity.legal_name,
      receiver_name: receiverEntity.legal_name,
      amount: riskTransaction.amount,
      currency: draft.currency,
      amount_base: draft.amountBase,
      sender_country: draft.sender.country,
      receiver_country: draft.receiver.country,
      channel: draft.channel,
      purpose_code: draft.purpose,
      status: "settled",
      risk_score: result.score,
      risk_level: result.level,
      score_ms: 70 + Math.floor(random() * 180),
      risk_factors: riskFactors,
      scored_at: createdAt,
      model_version: result.modelVersion,
      created_at: createdAt,
    });

    history.get(draft.sender.id)!.push({
      counterpartyId: draft.receiver.id,
      corridor: `${draft.sender.country}-${draft.receiver.country}`,
      amountBase: draft.amountBase,
      createdAt,
      direction: "out",
      externalId: draft.externalId,
    });
    history.get(draft.receiver.id)!.push({
      counterpartyId: draft.sender.id,
      corridor: `${draft.sender.country}-${draft.receiver.country}`,
      amountBase: draft.amountBase,
      createdAt,
      direction: "in",
      externalId: draft.externalId,
    });
    recentTransfers.push({
      fromAccountId: draft.sender.id,
      toAccountId: draft.receiver.id,
      amountBase: draft.amountBase,
      createdAt,
    });
  }

  /* ------------------------------------------------------------------ alerts */

  const slaHours: Record<RiskLevelDb, number> = { critical: 4, high: 12, medium: 24, low: 48 };
  const alerts: DemoAlertRow[] = [];
  const flaggedRows = transactions
    .filter((row) => row.risk_score >= SCORE_BANDS.alert)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 60);

  for (const row of flaggedRows) {
    const top = row.risk_factors[0];
    const label = typeof top?.label === "string" ? top.label : "Elevated model score";
    const level = scoreToLevel(row.risk_score);
    const createdAt = new Date(row.created_at);
    alerts.push({
      organization_id: organizationId,
      transaction_id: row.id,
      title: `${label} on ${row.sender_country}-${row.receiver_country} for ${row.external_id}`,
      severity: level,
      status: "new",
      due_at: new Date(createdAt.getTime() + (slaHours[level] ?? 48) * MS_HOUR).toISOString(),
      first_seen_at: row.created_at,
      summary: `${row.sender_name} → ${row.receiver_name} scored ${row.risk_score}/100 on ${row.sender_country}-${row.receiver_country}.`,
      score_snapshot: {
        score: row.risk_score,
        level,
        contributions: row.risk_factors,
        summary: `${label} is the largest contributor to a score of ${row.risk_score}.`,
        modelVersion: row.model_version,
      },
      created_at: row.created_at,
    });
  }

  const totalScore = transactions.reduce((sum, row) => sum + row.risk_score, 0);

  return {
    entities,
    accounts,
    transactions,
    alerts,
    summary: {
      payments: transactions.length,
      flagged: transactions.filter((row) => row.risk_score >= SCORE_BANDS.alert).length,
      alerts: alerts.length,
      entities: entities.length,
      accounts: accounts.length,
      days,
      from: transactions[0]?.created_at ?? now.toISOString(),
      to: transactions[transactions.length - 1]?.created_at ?? now.toISOString(),
      averageScore: transactions.length ? Math.round((totalScore / transactions.length) * 10) / 10 : 0,
    },
  };
}

/** The expected settlement currency for a country, when the scoring map carries one. */
const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  Object.entries(currencyCountryMap).map(([currency, country]) => [country, currency]),
);

function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country] ?? "USD";
}
