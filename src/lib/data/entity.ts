import "server-only";

import { rangeWindow, type RangeKey } from "@/lib/data/common";
import type { TransactionListRow } from "@/lib/data/transactions";
import type { Database } from "@/lib/supabase/database.types";
import type { RiskLevel } from "@/config/risk";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface EntityAccount {
  id: string;
  externalRef: string;
  currency: string;
  status: string;
  riskTier: string;
  openedAt: string;
}

export interface EntityFlowBucket {
  label: string;
  inValue: number;
  outValue: number;
  count: number;
  flagged: number;
}

export interface EntityCounterparty {
  entityId: string | null;
  name: string;
  country: string;
  direction: "in" | "out";
  value: number;
  count: number;
  averageScore: number;
}

export interface EntityFlag {
  id: string;
  label: string;
  severity: "watch" | "high" | "critical";
  detail: string;
}

export interface EntityProfile {
  entity: {
    id: string;
    legalName: string;
    kind: "individual" | "company" | "intermediary";
    country: string;
    pep: boolean;
    nominee: string | null;
    incorporatedOn: string | null;
    createdAt: string;
  };
  accounts: EntityAccount[];
  totals: {
    inValue: number;
    outValue: number;
    inCount: number;
    outCount: number;
    flagged: number;
    averageScore: number;
    maxScore: number;
    firstAt: string | null;
    lastAt: string | null;
  };
  flow: EntityFlowBucket[];
  corridors: Array<{ corridor: string; value: number; count: number; flagged: number }>;
  counterparties: EntityCounterparty[];
  transactions: TransactionListRow[];
  flags: EntityFlag[];
  range: { from: string; to: string; days: number };
}

const MAX_ROWS = 4_000;

function bucketsFor(range: RangeKey, from: Date, to: Date) {
  const span = Math.max(1, to.getTime() - from.getTime());
  const hourly = range === "24h";
  const count = hourly ? 24 : Math.min(30, Math.max(7, Math.ceil(span / 86_400_000)));
  const width = span / count;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    ...(hourly ? { hour: "2-digit", hour12: false } : {}),
    timeZone: "UTC",
  });
  // Labels must be unique: the chart keys its categories by label, so a window
  // shorter than the bucket count (or several buckets inside one day) used to
  // produce repeated labels — every bucket then folded into a single slot and
  // the chart drew one enormous bar. Appending the index keeps them distinct.
  const seen = new Map<string, number>();
  const buckets: EntityFlowBucket[] = Array.from({ length: count }, (_, index) => {
    const start = new Date(from.getTime() + index * width);
    const base = formatter.format(start);
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    return {
      label: repeat === 0 ? base : `${base} ·${repeat + 1}`,
      inValue: 0,
      outValue: 0,
      count: 0,
      flagged: 0,
    };
  });
  return { buckets, width, count };
}

function toRow(row: Database["public"]["Tables"]["transactions"]["Row"]): TransactionListRow {
  return {
    id: row.id,
    externalId: row.external_id,
    createdAt: row.created_at,
    senderName: row.sender_name,
    receiverName: row.receiver_name,
    senderCountry: row.sender_country,
    receiverCountry: row.receiver_country,
    amount: Number(row.amount),
    currency: row.currency,
    amountBase: Number(row.amount_base),
    riskScore: row.risk_score ?? 0,
    riskLevel: (row.risk_level ?? "low") as RiskLevel,
    status: row.status,
    channel: row.channel,
    purposeCode: row.purpose_code,
  };
}

export async function getEntityProfile(
  supabase: Client,
  organizationId: string,
  entityId: string,
  range: RangeKey,
): Promise<EntityProfile | null> {
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select(
      "id, legal_name, kind, country, pep_flag, nominee_director_name, incorporated_on, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();

  if (entityError) throw new Error(entityError.message);
  if (!entity) return null;

  const { data: accountRows, error: accountError } = await supabase
    .from("accounts")
    .select("id, external_ref, currency, status, risk_tier, opened_at")
    .eq("organization_id", organizationId)
    .eq("entity_id", entityId)
    .order("opened_at", { ascending: true });

  if (accountError) throw new Error(accountError.message);
  const accountIds = (accountRows ?? []).map((account) => account.id);

  const { from, to, days } = rangeWindow(range);

  if (accountIds.length === 0) {
    return {
      entity: {
        id: entity.id,
        legalName: entity.legal_name,
        kind: entity.kind,
        country: entity.country,
        pep: entity.pep_flag,
        nominee: entity.nominee_director_name,
        incorporatedOn: entity.incorporated_on,
        createdAt: entity.created_at,
      },
      accounts: [],
      totals: {
        inValue: 0,
        outValue: 0,
        inCount: 0,
        outCount: 0,
        flagged: 0,
        averageScore: 0,
        maxScore: 0,
        firstAt: null,
        lastAt: null,
      },
      flow: bucketsFor(range, from, to).buckets,
      corridors: [],
      counterparties: [],
      transactions: [],
      flags: [],
      range: { from: from.toISOString(), to: to.toISOString(), days },
    };
  }

  const filter = accountIds
    .flatMap((id) => [`sender_account_id.eq.${id}`, `receiver_account_id.eq.${id}`])
    .join(",");

  const [
    { data: transactionRows, error: transactionError },
    { data: allAccounts },
    { data: allEntities },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .or(filter)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("accounts")
      .select("id, entity_id")
      .eq("organization_id", organizationId)
      .limit(5_000),
    supabase
      .from("entities")
      .select("id, legal_name, country")
      .eq("organization_id", organizationId)
      .limit(5_000),
  ]);

  if (transactionError) throw new Error(transactionError.message);

  const rows = transactionRows ?? [];
  const ownAccounts = new Set(accountIds);
  const accountEntity = new Map(
    (allAccounts ?? []).map((account) => [account.id, account.entity_id]),
  );
  const entityMeta = new Map((allEntities ?? []).map((item) => [item.id, item]));

  const { buckets, width, count } = bucketsFor(range, from, to);
  const counterparties = new Map<string, EntityCounterparty>();
  const corridors = new Map<
    string,
    { corridor: string; value: number; count: number; flagged: number }
  >();
  let inValue = 0;
  let outValue = 0;
  let inCount = 0;
  let outCount = 0;
  let flagged = 0;
  let scoreSum = 0;
  let maxScore = 0;
  let firstAt: string | null = null;
  let lastAt: string | null = null;

  for (const row of rows) {
    const amount = Number(row.amount_base ?? 0);
    const score = row.risk_score ?? 0;
    const isOut = ownAccounts.has(row.sender_account_id);
    const isIn = ownAccounts.has(row.receiver_account_id);
    scoreSum += score;
    maxScore = Math.max(maxScore, score);
    if (score >= 70) flagged += 1;
    if (!lastAt || row.created_at > lastAt) lastAt = row.created_at;
    if (!firstAt || row.created_at < firstAt) firstAt = row.created_at;

    const corridorKey = `${row.sender_country}-${row.receiver_country}`;
    const corridor = corridors.get(corridorKey) ?? {
      corridor: corridorKey,
      value: 0,
      count: 0,
      flagged: 0,
    };
    corridor.value += amount;
    corridor.count += 1;
    if (score >= 70) corridor.flagged += 1;
    corridors.set(corridorKey, corridor);

    const index = Math.min(
      count - 1,
      Math.max(0, Math.floor((new Date(row.created_at).getTime() - from.getTime()) / width)),
    );
    const bucket = buckets[index];
    if (bucket) {
      bucket.count += 1;
      if (score >= 70) bucket.flagged += 1;
      if (isOut) bucket.outValue += amount;
      if (isIn) bucket.inValue += amount;
    }

    if (isOut && !isIn) {
      outValue += amount;
      outCount += 1;
      const otherId = accountEntity.get(row.receiver_account_id) ?? null;
      const other = otherId ? entityMeta.get(otherId) : null;
      const key = `out:${otherId ?? row.receiver_name}`;
      const entry = counterparties.get(key) ?? {
        entityId: otherId,
        name: other?.legal_name ?? row.receiver_name,
        country: other?.country ?? row.receiver_country,
        direction: "out" as const,
        value: 0,
        count: 0,
        averageScore: 0,
      };
      entry.value += amount;
      entry.count += 1;
      entry.averageScore += score;
      counterparties.set(key, entry);
    } else if (isIn && !isOut) {
      inValue += amount;
      inCount += 1;
      const otherId = accountEntity.get(row.sender_account_id) ?? null;
      const other = otherId ? entityMeta.get(otherId) : null;
      const key = `in:${otherId ?? row.sender_name}`;
      const entry = counterparties.get(key) ?? {
        entityId: otherId,
        name: other?.legal_name ?? row.sender_name,
        country: other?.country ?? row.sender_country,
        direction: "in" as const,
        value: 0,
        count: 0,
        averageScore: 0,
      };
      entry.value += amount;
      entry.count += 1;
      entry.averageScore += score;
      counterparties.set(key, entry);
    }
  }

  const averageScore = rows.length ? Math.round(scoreSum / rows.length) : 0;
  const flags: EntityFlag[] = [];

  if (entity.pep_flag) {
    flags.push({
      id: "pep",
      label: "Politically exposed person",
      severity: "critical",
      detail:
        "The entity record carries a PEP flag. Enhanced due diligence applies to every flow below.",
    });
  }
  if (entity.nominee_director_name) {
    flags.push({
      id: "nominee",
      label: "Nominee director on record",
      severity: "high",
      detail: `Director of record: ${entity.nominee_director_name}. Nominee arrangements obscure beneficial ownership.`,
    });
  }
  const passThrough = inValue > 0 ? outValue / inValue : 0;
  if (inCount >= 3 && outCount >= 3 && passThrough > 0.85) {
    flags.push({
      id: "pass-through",
      label: "Pass-through profile",
      severity: averageScore >= 70 ? "critical" : "high",
      detail: `${Math.round(passThrough * 100)}% of inbound value leaves again within the window (${inCount} in / ${outCount} out).`,
    });
  }
  if (maxScore >= 85) {
    flags.push({
      id: "score",
      label: "Critical payment in window",
      severity: "critical",
      detail: `The highest scored payment reached ${maxScore}. Open the workbench to see which signals produced it.`,
    });
  }
  if (entity.incorporated_on) {
    const ageDays = Math.floor(
      (Date.now() - new Date(entity.incorporated_on).getTime()) / 86_400_000,
    );
    if (ageDays >= 0 && ageDays <= 180) {
      flags.push({
        id: "new-entity",
        label: "Recently incorporated",
        severity: "watch",
        detail: `Incorporated ${ageDays} days ago and already moving ${inValue + outValue > 0 ? "material value" : "payments"} through the network.`,
      });
    }
  }
  if (accountIds.length > 1) {
    flags.push({
      id: "multi-account",
      label: `${accountIds.length} accounts`,
      severity: "watch",
      detail:
        "Multiple settlement accounts linked to one entity. Check whether each has a documented purpose.",
    });
  }

  return {
    entity: {
      id: entity.id,
      legalName: entity.legal_name,
      kind: entity.kind,
      country: entity.country,
      pep: entity.pep_flag,
      nominee: entity.nominee_director_name,
      incorporatedOn: entity.incorporated_on,
      createdAt: entity.created_at,
    },
    accounts: (accountRows ?? []).map((account) => ({
      id: account.id,
      externalRef: account.external_ref,
      currency: account.currency,
      status: account.status,
      riskTier: account.risk_tier,
      openedAt: account.opened_at,
    })),
    totals: {
      inValue: Math.round(inValue),
      outValue: Math.round(outValue),
      inCount,
      outCount,
      flagged,
      averageScore,
      maxScore,
      firstAt,
      lastAt,
    },
    flow: buckets,
    corridors: [...corridors.values()]
      .map((entry) => ({ ...entry, value: Math.round(entry.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4),
    counterparties: [...counterparties.values()]
      .map((entry) => ({
        ...entry,
        value: Math.round(entry.value),
        averageScore: entry.count ? Math.round(entry.averageScore / entry.count) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    transactions: rows.slice(0, 12).map(toRow),
    flags,
    range: { from: from.toISOString(), to: to.toISOString(), days },
  };
}
