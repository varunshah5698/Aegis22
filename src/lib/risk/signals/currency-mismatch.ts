import { currencyCountryMap } from "@/config/risk";
import type { RiskConfig } from "@/lib/risk/config";
import { defaultRiskConfig } from "@/lib/risk/config";
import type { RiskTransaction, ScoringContext, SignalResult } from "@/lib/risk/types";

export function currencyMismatchSignal(
  transaction: RiskTransaction,
  context: ScoringContext,
  _config: RiskConfig = defaultRiskConfig,
): SignalResult {
  const expected = currencyCountryMap[transaction.currency];
  const senderCurrency = context.accounts[transaction.senderAccountId]?.currency;

  if (!expected) {
    return {
      id: "currency_mismatch",
      raw: 0,
      narrative: "The settlement currency is not in the configured currency-to-country map.",
      facts: { currency: transaction.currency, expected_country: "unknown" },
    };
  }

  const countryMismatch = expected !== transaction.senderCountry;
  const accountMismatch = Boolean(senderCurrency && senderCurrency !== transaction.currency);
  const raw = countryMismatch ? 0.8 : accountMismatch ? 0.4 : 0;

  return {
    id: "currency_mismatch",
    raw,
    narrative:
      raw > 0
        ? `The transfer settles in ${transaction.currency} while the sender is domiciled in ${transaction.senderCountry}, whose expected settlement currency is ${expected}.`
        : `The settlement currency ${transaction.currency} is consistent with the sender's jurisdiction.`,
    facts: {
      currency: transaction.currency,
      expected_country: expected,
      sender_country: transaction.senderCountry,
      sender_account_currency: senderCurrency ?? "unknown",
    },
  };
}
