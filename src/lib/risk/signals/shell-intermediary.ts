import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import { accountAgeDays, daysBetween, round, sumAmount } from "@/lib/risk/context";
import type { AccountContext, RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

interface ShellAssessment {
  account: AccountContext;
  young: boolean;
  passThrough: boolean;
  nominee: boolean;
  ageDays: number;
  ratio: number;
  inbound: number;
  forwarded: number;
}

function assess(
  account: AccountContext | undefined,
  transaction: RiskTransaction,
  config: RiskConfig,
): ShellAssessment | null {
  if (!account || (account.entityKind !== "company" && account.entityKind !== "intermediary")) {
    return null;
  }

  const at = new Date(transaction.createdAt).getTime();
  const ageDays = account.incorporatedOn
    ? Math.max(0, daysBetween(account.incorporatedOn, transaction.createdAt))
    : accountAgeDays(account, transaction.createdAt);

  const sixHoursAgo = at - 6 * 3_600_000;
  const inboundItems = account.history.filter(
    (item) =>
      item.direction === "in" &&
      new Date(item.createdAt).getTime() >= sixHoursAgo &&
      new Date(item.createdAt).getTime() <= at,
  );
  const inbound = sumAmount(inboundItems);
  const earliestInbound = inboundItems.length
    ? Math.min(...inboundItems.map((item) => new Date(item.createdAt).getTime()))
    : at;
  // The outbound leg being scored is part of the value being forwarded, so it
  // counts toward the ratio; otherwise a shell splitting its outflow into
  // tranches could never cross the pass-through threshold on its final leg.
  const forwarded =
    sumAmount(
      account.history.filter((item) => {
        if (item.direction !== "out") return false;
        if (item.externalId && item.externalId === transaction.externalId) return false;
        const time = new Date(item.createdAt).getTime();
        return time >= earliestInbound && time <= Math.min(at, earliestInbound + 6 * 3_600_000);
      }),
    ) + (account.id === transaction.senderAccountId ? transaction.amountBase : 0);
  const ratio = inbound > 0 ? forwarded / inbound : 0;

  return {
    account,
    young: ageDays < config.shellMaxAgeDays,
    passThrough: inbound > 0 && ratio >= config.shellPassThroughRatio,
    nominee: account.nomineeEntityCount >= config.shellNomineeCount,
    ageDays,
    ratio,
    inbound,
    forwarded,
  };
}

export function shellIntermediarySignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const receiver = assess(
    context.accounts[transaction.receiverAccountId],
    transaction,
    config,
  );
  const sender = assess(context.accounts[transaction.senderAccountId], transaction, config);
  const chosen = [receiver, sender]
    .filter((item): item is ShellAssessment => item !== null)
    .sort((a, b) => {
      const score = (item: ShellAssessment) =>
        (item.young ? 0.35 : 0) + (item.passThrough ? 0.55 : 0) + (item.nominee ? 0.35 : 0);
      return score(b) - score(a);
    })[0];

  if (!chosen) {
    return {
      id: "shell_intermediary",
      raw: 0,
      narrative: "Neither party is a company exhibiting intermediary indicators.",
      facts: { company: false },
    };
  }

  const raw = Math.min(
    1,
    (chosen.young ? 0.35 : 0) + (chosen.passThrough ? 0.55 : 0) + (chosen.nominee ? 0.35 : 0),
  );

  const indicators: string[] = [];
  if (chosen.young) indicators.push(`incorporated ${Math.round(chosen.ageDays)} days ago`);
  if (chosen.passThrough)
    indicators.push(`forwarded ${round(chosen.ratio * 100, 0)}% of inbound value within 6 hours`);
  if (chosen.nominee)
    indicators.push(`shares a nominee director with ${chosen.account.nomineeEntityCount} other entities`);

  const narrative =
    raw > 0
      ? `${chosen.account.entityName} ${indicators.join(" and ")}.`
      : `${chosen.account.entityName} does not show recent incorporation, rapid pass-through, or shared nominee control.`;

  return {
    id: "shell_intermediary",
    raw,
    narrative,
    facts: {
      company: true,
      entity: chosen.account.entityName,
      age_days: Math.round(chosen.ageDays),
      pass_through_ratio: round(chosen.ratio, 3),
      nominee_entities: chosen.account.nomineeEntityCount,
      inbound_base: round(chosen.inbound),
      forwarded_base: round(chosen.forwarded),
    },
  };
}
