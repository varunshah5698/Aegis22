import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

export function pepExposureSignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  _config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const receiver = context.accounts[transaction.receiverAccountId];
  const sender = context.accounts[transaction.senderAccountId];

  const raw = receiver?.pepFlag ? 1 : sender?.pepFlag ? 0.6 : 0;
  const subject = receiver?.pepFlag ? receiver : sender?.pepFlag ? sender : null;

  return {
    id: "pep_exposure",
    raw,
    narrative: subject
      ? `${subject.entityName} is flagged as a politically exposed person or close associate.`
      : "Neither party is flagged as politically exposed.",
    facts: {
      receiver_pep: Boolean(receiver?.pepFlag),
      sender_pep: Boolean(sender?.pepFlag),
    },
  };
}
