import "server-only";

import { rangeWindow, type RangeKey } from "@/lib/data/common";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface NetworkNode {
  id: string;
  label: string;
  kind: "individual" | "company" | "intermediary";
  country: string;
  pep: boolean;
  nominee: boolean;
  accountCount: number;
  outValue: number;
  inValue: number;
  outCount: number;
  inCount: number;
  averageScore: number;
  flagged: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  value: number;
  count: number;
  averageScore: number;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: {
    entities: number;
    transfers: number;
    value: number;
    flagged: number;
    averageScore: number;
  };
  truncated: boolean;
}

const MAX_NODES = 60;

export async function getNetworkGraph(
  supabase: Client,
  organizationId: string,
  range: RangeKey,
): Promise<NetworkGraph> {
  const { from } = rangeWindow(range);

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("sender_account_id, receiver_account_id, amount_base, risk_score")
    .eq("organization_id", organizationId)
    .gte("created_at", from.toISOString())
    .limit(20_000);

  if (error) throw new Error(error.message);
  const rows = transactions ?? [];

  if (rows.length === 0) {
    return { nodes: [], edges: [], stats: { entities: 0, transfers: 0, value: 0, flagged: 0, averageScore: 0 }, truncated: false };
  }

  // Scoping by organization keeps the request URL short; filtering by a list of
  // thousands of account ids overflows PostgREST's query string limit.
  const [{ data: accounts, error: accountError }, { data: entities, error: entityError }] = await Promise.all([
    supabase.from("accounts").select("id, entity_id, status, risk_tier").eq("organization_id", organizationId).limit(5000),
    supabase
      .from("entities")
      .select("id, legal_name, kind, country, pep_flag, nominee_director_name")
      .eq("organization_id", organizationId)
      .limit(5000),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (entityError) throw new Error(entityError.message);

  const accountEntity = new Map((accounts ?? []).map((account) => [account.id, account.entity_id]));
  const entityMeta = new Map((entities ?? []).map((entity) => [entity.id, entity]));

  const nodes = new Map<string, NetworkNode>();
  const ensureNode = (entityId: string): NetworkNode => {
    const existing = nodes.get(entityId);
    if (existing) return existing;
    const entity = entityMeta.get(entityId);
    const node: NetworkNode = {
      id: entityId,
      label: entity?.legal_name ?? "Unknown entity",
      kind: (entity?.kind ?? "company") as NetworkNode["kind"],
      country: entity?.country ?? "—",
      pep: entity?.pep_flag ?? false,
      nominee: Boolean(entity?.nominee_director_name),
      accountCount: 0,
      outValue: 0,
      inValue: 0,
      outCount: 0,
      inCount: 0,
      averageScore: 0,
      flagged: 0,
    };
    nodes.set(entityId, node);
    return node;
  };

  const edgeMap = new Map<string, NetworkEdge>();
  let value = 0;
  let flagged = 0;
  let scoreSum = 0;

  for (const row of rows) {
    const sender = accountEntity.get(row.sender_account_id);
    const receiver = accountEntity.get(row.receiver_account_id);
    const amount = Number(row.amount_base ?? 0);
    const score = row.risk_score ?? 0;
    value += amount;
    scoreSum += score;
    if (score >= 70) flagged += 1;

    if (!sender || !receiver) continue;
    const senderNode = ensureNode(sender);
    const receiverNode = ensureNode(receiver);
    senderNode.outValue += amount;
    senderNode.outCount += 1;
    receiverNode.inValue += amount;
    receiverNode.inCount += 1;
    if (score >= 70) {
      senderNode.flagged += 1;
      receiverNode.flagged += 1;
    }

    const key = `${sender}->${receiver}`;
    const edge = edgeMap.get(key) ?? { source: sender, target: receiver, value: 0, count: 0, averageScore: 0 };
    edge.value += amount;
    edge.count += 1;
    edge.averageScore += score;
    edgeMap.set(key, edge);
  }

  for (const node of nodes.values()) {
    node.accountCount = Math.max(1, (accounts ?? []).filter((account) => account.entity_id === node.id).length);
  }

  const scoreTotals = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const sender = accountEntity.get(row.sender_account_id);
    const receiver = accountEntity.get(row.receiver_account_id);
    const score = row.risk_score ?? 0;
    if (sender) {
      const entry = scoreTotals.get(sender) ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count += 1;
      scoreTotals.set(sender, entry);
    }
    if (receiver) {
      const entry = scoreTotals.get(receiver) ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count += 1;
      scoreTotals.set(receiver, entry);
    }
  }
  for (const [id, entry] of scoreTotals) {
    const node = nodes.get(id);
    if (node) node.averageScore = entry.count ? Math.round(entry.sum / entry.count) : 0;
  }

  const ranked = [...nodes.values()].sort((a, b) => b.inValue + b.outValue - (a.inValue + a.outValue));
  const truncated = ranked.length > MAX_NODES;
  const kept = ranked.slice(0, MAX_NODES);
  const keptIds = new Set(kept.map((node) => node.id));

  const edges = [...edgeMap.values()]
    .filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      value: Math.round(edge.value),
      averageScore: edge.count ? Math.round(edge.averageScore / edge.count) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 220);

  return {
    nodes: kept,
    edges,
    stats: {
      entities: kept.length,
      transfers: rows.length,
      value: Math.round(value),
      flagged,
      averageScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
    },
    truncated,
  };
}

export interface NetworkFlag {
  id: string;
  label: string;
  country: string;
  reason: string;
  severity: "high" | "critical";
  nodeId: string;
}

export function describeNetworkFlags(nodes: NetworkNode[]): NetworkFlag[] {
  const flags: NetworkFlag[] = [];
  for (const node of nodes) {
    const ratio = node.inValue > 0 ? node.outValue / node.inValue : 0;
    if (node.pep) {
      flags.push({
        id: `${node.id}-pep`,
        label: node.label,
        country: node.country,
        reason: "Politically exposed person on the entity record",
        severity: "critical",
        nodeId: node.id,
      });
      continue;
    }
    if (node.nominee) {
      flags.push({
        id: `${node.id}-nominee`,
        label: node.label,
        country: node.country,
        reason: "Nominee director and an intermediary profile",
        severity: "high",
        nodeId: node.id,
      });
      continue;
    }
    if (node.inCount >= 3 && ratio > 0.85 && node.outCount >= 3) {
      flags.push({
        id: `${node.id}-pass`,
        label: node.label,
        country: node.country,
        reason: `Pass-through pattern: ${Math.round(ratio * 100)}% of inbound value forwarded (${node.inCount} in / ${node.outCount} out)`,
        severity: node.averageScore >= 70 ? "critical" : "high",
        nodeId: node.id,
      });
    }
  }
  return flags.slice(0, 8);
}
