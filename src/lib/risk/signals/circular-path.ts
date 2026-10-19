import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { round } from "@/lib/risk/context";
import type { RiskTransaction, ScoringContext, SignalResult, TransferEdge } from "@/lib/risk/types";

interface PathResult {
  path: string[];
  amounts: number[];
}

function findCycle(
  edges: TransferEdge[],
  start: string,
  maxEdges: number,
  minRetained: number,
): PathResult | null {
  const byFrom = new Map<string, TransferEdge[]>();
  for (const edge of edges) {
    const list = byFrom.get(edge.fromAccountId) ?? [];
    list.push(edge);
    byFrom.set(edge.fromAccountId, list);
  }

  function walk(
    current: string,
    path: string[],
    amounts: number[],
    visited: Set<string>,
  ): PathResult | null {
    const edgesUsed = path.length - 1;
    if (edgesUsed >= maxEdges) return null;
    const outgoing = byFrom.get(current) ?? [];
    for (const edge of outgoing) {
      const previous = amounts[amounts.length - 1] ?? 0;
      if (previous > 0 && edge.amountBase < previous * minRetained) continue;

      if (edge.toAccountId === start && edgesUsed + 1 >= 2) {
        return { path: [...path, start], amounts: [...amounts, edge.amountBase] };
      }
      if (visited.has(edge.toAccountId)) continue;
      if (edgesUsed + 1 >= maxEdges) continue;

      const nextVisited = new Set(visited);
      nextVisited.add(edge.toAccountId);
      const found = walk(
        edge.toAccountId,
        [...path, edge.toAccountId],
        [...amounts, edge.amountBase],
        nextVisited,
      );
      if (found) return found;
    }
    return null;
  }

  return walk(start, [start], [], new Set([start]));
}

export function circularPathSignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const at = new Date(transaction.createdAt).getTime();
  const windowStart = at - config.circularWindowHours * 3_600_000;

  const edges = context.recentTransfers.filter((edge) => {
    const time = new Date(edge.createdAt).getTime();
    return time >= windowStart && time <= at;
  });

  if (!edges.some((edge) => edge.fromAccountId === transaction.senderAccountId && edge.toAccountId === transaction.receiverAccountId && edge.amountBase === transaction.amountBase)) {
    edges.push({
      fromAccountId: transaction.senderAccountId,
      toAccountId: transaction.receiverAccountId,
      amountBase: transaction.amountBase,
      createdAt: transaction.createdAt,
    });
  }

  const cycle = findCycle(
    edges,
    transaction.senderAccountId,
    config.circularMaxEdges,
    config.circularMinRetainedRatio,
  );

  if (!cycle) {
    return {
      id: "circular_path",
      raw: 0,
      narrative: "Funds do not return to the originating account within the 72-hour graph window.",
      facts: { hops: 0 },
    };
  }

  const label = (accountId: string) =>
    context.accounts[accountId]?.entityName ?? context.accounts[accountId]?.id ?? accountId;
  const route = cycle.path.map(label).join(" → ");
  const retention = cycle.amounts[cycle.amounts.length - 1]! / transaction.amountBase;

  return {
    id: "circular_path",
    raw: 1,
    narrative: `Funds move in a ${cycle.path.length - 1}-hop loop (${route}) that returns to the sender within 72 hours, retaining ${round(retention * 100, 0)}% of value after fees.`,
    facts: {
      hops: cycle.path.length - 1,
      route,
      value_retained_ratio: round(retention, 3),
      amount_base: round(transaction.amountBase),
    },
  };
}
