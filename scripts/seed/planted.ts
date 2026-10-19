import type { GeneratedOrgData, SeedAccount, SeedEntity, SeedTransaction } from "./types";

/**
 * Planted typologies with fixed ids so integration tests and documentation can
 * reference exact accounts. Each pattern is multi-signal the way a real case
 * presents: a primary typology plus corroborating context (high-risk
 * jurisdiction, first-time corridor, PEP counterparty, related accounts).
 */
export const plantedIds = {
  clusterAccounts: Array.from(
    { length: 8 },
    (_, index) => `c1a00000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
  ),
  circularAccounts: Array.from(
    { length: 8 },
    (_, index) => `c1cc0000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
  ),
  shellAccounts: Array.from(
    { length: 4 },
    (_, index) => `5e110000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
  ),
  spikeAccounts: Array.from(
    { length: 10 },
    (_, index) => `5b1ce000-0000-4000-8000-0000000000${String(index + 10)}`,
  ),
  firstTimeAccounts: Array.from(
    { length: 20 },
    (_, index) => `f1570000-0000-4000-8000-0000000000${String(index + 10).padStart(2, "0")}`,
  ),
  /** Recently incorporated PEP intermediaries that receive the laundered value. */
  beneficiaryAccounts: Array.from(
    { length: 6 },
    (_, index) => `be9e0000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
  ),
} as const;

export const NOMINEE_DIRECTOR = "Marco Delgado Reyes";
export const SHELL_NAMES = [
  "Horizon Trade FZE",
  "Silverline Commodities Ltd",
  "Bridgepoint Logistics DMCC",
  "Northgate Metals Ltd",
];
export const LOOP_NAMES = [
  "Aurelia FZE",
  "Cobalt Route Ltd",
  "Vantor Holdings Pte",
  "Ardent Metals Ltd",
  "Halcyon Trade SA",
  "Pinnacle Route FZE",
  "Talos Holdings Ltd",
  "Solstice Transit BV",
];
export const BENEFICIARY_NAMES = [
  "Caspian Union Trade",
  "Volga Marine Services",
  "Zagros Holdings",
  "Damascus Route Ltd",
  "Bakhtaran Trading",
  "Ormuz Logistics",
];

const ADVANCED = "2021-06-15";
const MS_DAY = 86_400_000;
const REFERENCE = Date.now();

function isoDaysAgo(days: number): string {
  return new Date(REFERENCE - days * MS_DAY).toISOString().slice(0, 10);
}

function hexId(prefix: string, index: number): string {
  const head = (prefix.toLowerCase() + "00000000").replace(/[^0-9a-f]/g, "0").slice(0, 8);
  return `${head}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

/** Stable account id derived from a planted entity key. */
export function accountKeyId(key: string): string {
  return `a${key.slice(1)}`;
}

function entityKeyId(key: string): string {
  return `e${key.slice(1)}`;
}

export function currencyFor(country: string): string {
  const map: Record<string, string> = {
    US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IN: "INR", AE: "AED",
    SG: "SGD", JP: "JPY", CN: "CNY", BR: "BRL", CH: "CHF", AU: "AUD", CA: "CAD", HK: "HKD",
    ZA: "ZAR", NG: "NGN", KE: "KES", TR: "TRY", MX: "MXN", PK: "PKR", MM: "MMK", CY: "EUR",
    IR: "IRR", RU: "RUB",
  };
  return map[country] ?? "USD";
}

function buildWriter(organizationId: string, data: GeneratedOrgData, partners: SeedAccount[]) {
  const entityIndex = new Map(data.entities.map((value) => [value.id, value]));
  const accountIndex = new Map(data.accounts.map((value) => [value.id, value]));

  const ensureAccount = (
    key: string,
    kind: SeedEntity["kind"],
    legalName: string,
    country: string,
    options: {
      incorporatedOn: string;
      nominee?: string;
      pep?: boolean;
      device?: string;
      openedAt?: string;
    },
  ): SeedAccount => {
    const entityId = entityKeyId(key);
    if (!entityIndex.has(entityId)) {
      const value: SeedEntity = {
        id: entityId,
        organizationId,
        kind,
        legalName,
        country,
        incorporatedOn: kind === "individual" ? null : options.incorporatedOn,
        registrationNumber: kind === "individual" ? null : `REG-${key.toUpperCase()}`,

        pepFlag: options.pep ?? false,
        nomineeDirectorName: options.nominee ?? null,
        metadata: options.device ? { shared_device_id: options.device } : {},
      };
      entityIndex.set(entityId, value);
      data.entities.push(value);
      if (options.nominee) {
        data.nomineeCounts.set(options.nominee, (data.nomineeCounts.get(options.nominee) ?? 0) + 1);
      }
    }

    const accountId = accountKeyId(key);
    if (!accountIndex.has(accountId)) {
      const value: SeedAccount = {
        id: accountId,
        organizationId,
        externalRef: `ACC-${key.toUpperCase()}`,
        entityId,
        country,
        currency: "USD",
        status: "active",
        openedAt: options.openedAt ?? options.incorporatedOn,
        riskTier: "high",
      };
      accountIndex.set(accountId, value);
      data.accounts.push(value);
    }
    return accountIndex.get(accountId)!;
  };

  const link = (a: string, b: string) => {
    if (a === b) return;
    const left = data.relations.get(a) ?? new Set<string>();
    left.add(b);
    data.relations.set(a, left);
    const right = data.relations.get(b) ?? new Set<string>();
    right.add(a);
    data.relations.set(b, right);
  };

  const linkAll = (ids: string[]) => {
    for (let index = 1; index < ids.length; index++) link(ids[0]!, ids[index]!);
  };

  const push = (value: Omit<SeedTransaction, "organizationId">) => {
    data.transactions.push({ ...value, organizationId });
  };

  return { ensureAccount, link, linkAll, push, partners };
}

export function addPlantedPatterns(context: {
  organizationId: string;
  data: GeneratedOrgData;
  partnerAccounts: SeedAccount[];
}): void {
  const writer = buildWriter(context.organizationId, context.data, context.partnerAccounts.slice(0, 40));
  const { ensureAccount, linkAll, push, partners } = writer;
  const day = (daysAgo: number, hour: number) =>
    new Date(REFERENCE - daysAgo * MS_DAY + (hour + 8) * 3_600_000 + 15 * 60_000).toISOString();

  /**
   * Establishes a believable trading history so velocity compares against a
   * baseline instead of treating a brand-new account as "no signal".
   */
  const baseline = (account: SeedAccount, keyPrefix: string, count: number) => {
    for (let index = 0; index < count; index++) {
      const partner = partners[(index * 7 + keyPrefix.length) % partners.length]!;
      const amount = 240 + ((index * 137) % 620);
      push({
        id: hexId(keyPrefix, index),
        externalId: `SEED-BASE-${keyPrefix.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
        amount,
        currency: "USD",
        amountBase: amount,
        senderAccountId: account.id,
        receiverAccountId: partner.id,
        senderName: account.externalRef,
        receiverName: partner.externalRef,
        senderCountry: account.country,
        receiverCountry: partner.country,
        channel: "SWIFT",
        purposeCode: "GOODS",
        createdAt: day(86 - index * 7, 3 + (index % 7)),
      });
    }
  };

  const beneficiary = (index: number, country: string) =>
    ensureAccount(plantedIds.beneficiaryAccounts[index % 6]!, "intermediary", BENEFICIARY_NAMES[index % 6]!, country, {
      incorporatedOn: isoDaysAgo(55),
      nominee: NOMINEE_DIRECTOR,
      pep: true,
    });

  const shell = (index: number) =>
    ensureAccount(plantedIds.shellAccounts[index]!, "intermediary", SHELL_NAMES[index]!, "MM", {
      incorporatedOn: isoDaysAgo(70),
      nominee: NOMINEE_DIRECTOR,
      pep: true,
      device: `device-shell-pair-${Math.floor(index / 2)}`,
    });

  // --------------------------------------------------------------------------
  // 1. Structuring: sub-threshold transfers from related accounts into freshly
  //    incorporated intermediaries on a high-risk corridor, settled in USD from
  //    jurisdictions whose currency is not USD.
  // --------------------------------------------------------------------------
  const clusterPlan = [
    { indices: [0, 1], count: 7, daysAgo: 41, country: "PK", shellIndex: 0 },
    { indices: [2, 3, 4], count: 9, daysAgo: 33, country: "AE", shellIndex: 1 },
    { indices: [5, 6], count: 6, daysAgo: 25, country: "TR", shellIndex: 2 },
  ];

  clusterPlan.forEach((plan, clusterIndex) => {
    const receiver = shell(plan.shellIndex);
    const senderAccounts = plan.indices.map((accountIndex) =>
      ensureAccount(
        plantedIds.clusterAccounts[accountIndex]!,
        "individual",
        `Cluster Contact ${accountIndex + 1}`,
        plan.country,
        { incorporatedOn: ADVANCED, device: `device-cluster-${clusterIndex}` },
      ),
    );
    const senderIds = senderAccounts.map((account) => account.id);
    linkAll(senderIds);
    senderAccounts.forEach((account, position) =>
      baseline(account, `d${clusterIndex + 1}b${position}`, 6),
    );

    for (let index = 0; index < plan.count; index++) {
      const amount = 9_350 + ((index * 90) % 500);
      push({
        id: hexId(`d${clusterIndex + 1}`, clusterIndex * 100 + index),
        externalId: `SEED-SPLIT-${clusterIndex + 1}-${String(index + 1).padStart(2, "0")}`,
        amount,
        currency: "USD",
        amountBase: amount,
        senderAccountId: senderIds[index % senderIds.length]!,
        receiverAccountId: receiver.id,
        senderName: `Cluster Contact ${index + 1}`,
        receiverName: SHELL_NAMES[plan.shellIndex]!,
        senderCountry: plan.country,
        receiverCountry: "MM",
        channel: "WIRE",
        purposeCode: "TRADE",
        createdAt: day(plan.daysAgo, -(index * 2)),
        planted: `splitting_cluster_${clusterIndex + 1}`,
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Circular flows: value leaves, passes through exposed intermediaries and
  //    returns to the originator inside 72 hours, losing only fees.
  // --------------------------------------------------------------------------
  const loopPlan = [
    { indices: [0, 1, 2, 3], daysAgo: 52, amount: 9_600, countries: ["AE", "IR", "MM", "AE"] },
    { indices: [3, 4, 5, 6], daysAgo: 18, amount: 9_500, countries: ["MM", "IR", "AE", "MM"] },
  ];

  loopPlan.forEach((plan, loopIndex) => {
    const ids = plan.indices.map((accountIndex, position) =>
      ensureAccount(
        plantedIds.circularAccounts[accountIndex]!,
        "intermediary",
        LOOP_NAMES[accountIndex]!,
        plan.countries[position]!,
        {
          incorporatedOn: isoDaysAgo(loopIndex === 0 ? 80 : 75),
          nominee: NOMINEE_DIRECTOR,
          pep: true,
          device: `device-loop-${loopIndex}`,
        },
      ).id,
    );
    linkAll(ids);

    const hopOrder = [...ids, ids[0]!];
    for (let hop = 0; hop < ids.length; hop++) {
      const fromId = hopOrder[hop]!;
      const toId = hopOrder[hop + 1]!;
      const fromAccount = context.data.accounts.find((value) => value.id === fromId)!;
      const toAccount = context.data.accounts.find((value) => value.id === toId)!;
      const amount = Math.round(plan.amount * 0.975 ** hop * 100) / 100;
      push({
        id: hexId(`ea${loopIndex + 1}`, loopIndex * 10 + hop),
        externalId: `SEED-LOOP-${loopIndex + 1}-${hop + 1}`,
        amount,
        currency: "USD",
        amountBase: amount,
        senderAccountId: fromId,
        receiverAccountId: toId,
        senderName: fromAccount.externalRef,
        receiverName: toAccount.externalRef,
        senderCountry: fromAccount.country,
        receiverCountry: toAccount.country,
        channel: "SWIFT",
        purposeCode: "SERVICES",
        createdAt: day(plan.daysAgo, -(hop * 9)),
        planted: `circular_flow_${loopIndex + 1}`,
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Shell intermediaries: paired companies incorporated weeks ago that
  //    forward 91% of inbound value within six hours in sub-threshold tranches
  //    to politically exposed beneficiaries. Both companies of a pair share a
  //    device fingerprint and one nominee director.
  // --------------------------------------------------------------------------
  const shellPairs = [
    { shells: [0, 1], beneficiaryCountry: "IR", inbound: 42_000, daysAgo: 12, tranches: 5 },
    { shells: [2, 3], beneficiaryCountry: "RU", inbound: 46_000, daysAgo: 20, tranches: 5 },
  ];

  shellPairs.forEach((pair, pairIndex) => {
    const target = beneficiary(pairIndex, pair.beneficiaryCountry);
    // Shells in a pair are related through a shared device fingerprint.
    writer.link(accountKeyId(plantedIds.shellAccounts[pair.shells[0]!]!), accountKeyId(plantedIds.shellAccounts[pair.shells[1]!]!));
    pair.shells.forEach((shellIndex, position) => {
      const entity = shell(shellIndex);
      const source = partners[pairIndex * 5 + position * 2]!;
      const inboundAmount = pair.inbound + position * 800;
      const tranche = Math.round((inboundAmount * 0.91) / pair.tranches);
      baseline(entity, `5e11d${pairIndex}${position}`, 6);

      push({
        id: hexId(`5e11b${pairIndex}`, shellIndex),
        externalId: `SEED-SHELL-${shellIndex + 1}-IN`,
        amount: inboundAmount,
        currency: "USD",
        amountBase: inboundAmount,
        senderAccountId: source.id,
        receiverAccountId: entity.id,
        senderName: source.externalRef,
        receiverName: SHELL_NAMES[shellIndex]!,
        senderCountry: source.country,
        receiverCountry: "MM",
        channel: "SWIFT",
        purposeCode: "GOODS",
        createdAt: day(pair.daysAgo, position),
        planted: `shell_intermediary_${shellIndex + 1}`,
      });

      for (let index = 0; index < pair.tranches; index++) {
        push({
          id: hexId(`5e11c${pairIndex}`, shellIndex * 16 + index),
          externalId: `SEED-SHELL-${shellIndex + 1}-OUT-${String(index + 1).padStart(2, "0")}`,
          amount: tranche,
          currency: "USD",
          amountBase: tranche,
          senderAccountId: entity.id,
          receiverAccountId: target.id,
          senderName: SHELL_NAMES[shellIndex]!,
          receiverName: BENEFICIARY_NAMES[pairIndex]!,
          senderCountry: "MM",
          receiverCountry: pair.beneficiaryCountry,
          channel: "WIRE",
          purposeCode: "SERVICES",
          createdAt: day(pair.daysAgo, position + 1 + index * 0.5),
          planted: `shell_intermediary_${shellIndex + 1}`,
        });
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Corridor spikes: five related companies push five times the normal
  //    48-hour volume on one corridor after a quiet 90-day baseline.
  // --------------------------------------------------------------------------
  const spikes = [
    { country: "AE", receiver: "IR", baselineDaysAgo: 70, spikeDaysAgo: 8, count: 55, beneficiary: 2 },
    { country: "US", receiver: "RU", baselineDaysAgo: 70, spikeDaysAgo: 63, count: 45, beneficiary: 3 },
  ];

  spikes.forEach((spike, spikeIndex) => {
    const pool = plantedIds.spikeAccounts.slice(spikeIndex * 5, spikeIndex * 5 + 5);
    const ids = pool.map((key, offset) =>
      ensureAccount(key, "company", `Spike Traders ${spikeIndex * 5 + offset + 1} Ltd`, spike.country, {
        incorporatedOn: ADVANCED,
        device: `device-spike-${spikeIndex}`,
      }).id,
    );
    linkAll(ids);

    ids.forEach((accountId, offset) => {
      for (let index = 0; index < 8; index++) {
        const partner = partners[(offset * 3 + index) % partners.length]!;
        const amount = 300 + ((index * 37) % 400);
        push({
          id: hexId(`ba${spikeIndex}${offset}`, index),
          externalId: `SEED-SPIKE-BASE-${spikeIndex + 1}-${offset + 1}-${index + 1}`,
          amount,
          currency: "USD",
          amountBase: amount,
          senderAccountId: accountId,
          receiverAccountId: partner.id,
          senderName: `Spike Traders ${offset + 1} Ltd`,
          receiverName: partner.externalRef,
          senderCountry: spike.country,
          receiverCountry: partner.country,
          channel: "SWIFT",
          purposeCode: "GOODS",
          createdAt: day(spike.baselineDaysAgo - index * 4, index * 2),
          planted: `corridor_spike_${spikeIndex + 1}`,
        });
      }
    });

    const target = beneficiary(spike.beneficiary, spike.receiver);

    for (let index = 0; index < spike.count; index++) {
      const senderId = ids[index % ids.length]!;
      const sender = context.data.accounts.find((value) => value.id === senderId)!;
      const amount = 9_350 + ((index * 73) % 550);
      push({
        id: hexId(`5912e${spikeIndex + 1}`, spikeIndex * 1000 + index),
        externalId: `SEED-SPIKE-${spikeIndex + 1}-${String(index + 1).padStart(3, "0")}`,
        amount,
        currency: "USD",
        amountBase: amount,
        senderAccountId: senderId,
        receiverAccountId: target.id,
        senderName: sender.externalRef,
        receiverName: BENEFICIARY_NAMES[spike.beneficiary % 6]!,
        senderCountry: spike.country,
        receiverCountry: spike.receiver,
        channel: "SWIFT",
        purposeCode: "TRADE",
        createdAt: day(spike.spikeDaysAgo - Math.floor((index % 44) / 24), -(index % 24)),
        planted: `corridor_spike_${spikeIndex + 1}`,
      });
    }
  });

  // --------------------------------------------------------------------------
  // 5. First-time high-risk corridors: twenty established accounts grouped in
  //    threes make their first transfers to restricted jurisdictions.
  // --------------------------------------------------------------------------
  const firstTimeIds: string[][] = [];
  plantedIds.firstTimeAccounts.forEach((key, index) => {
    const groupIndex = Math.min(5, Math.floor(index / 3));
    const country = index % 2 === 0 ? "US" : "GB";
    const account = ensureAccount(
      key,
      index % 3 === 0 ? "company" : "individual",
      `First Corridor Client ${index + 1}`,
      country,
      { incorporatedOn: ADVANCED, device: `device-first-${groupIndex}` },
    );
    const receiverCountry = groupIndex % 2 === 0 ? "IR" : "RU";
    baseline(account, `f157b${String(index).padStart(2, "0")}`, 6);
    (firstTimeIds[groupIndex] ??= []).push(account.id);

    for (let round = 1; round <= 2; round++) {
      const amount = 8_100 + ((index * 61 + round * 17) % 700);
      // The second transfer goes to a different beneficiary, so the counterparty
      // stays new even after the first transfer has settled.
      const receiverKey = round === 1 ? groupIndex : groupIndex + 3;
      const receiver = beneficiary(receiverKey, receiverCountry);
      push({
        id: hexId("f157", index * 2 + round),
        externalId: `SEED-FIRST-${String(index + 1).padStart(2, "0")}-${round}`,
        amount,
        currency: "USD",
        amountBase: amount,
        senderAccountId: account.id,
        receiverAccountId: receiver.id,
        senderName: `First Corridor Client ${index + 1}`,
        receiverName: BENEFICIARY_NAMES[receiverKey % 6]!,
        senderCountry: country,
        receiverCountry,
        channel: "WIRE",
        purposeCode: "INVEST",
        createdAt: day(6 + Math.floor(index / 3), -(index % 12) - (2 - round)),
        planted: `first_time_corridor_${index + 1}`,
      });
    }
  });

  // Each group of three shares a device fingerprint, so the cluster is related.
  firstTimeIds.forEach((ids) => linkAll(ids));
}
