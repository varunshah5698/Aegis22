"use client";

import * as React from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LatestResponse {
  data: {
    kind: "latest";
    latest: {
      base: string;
      rateDate: string;
      fetchedAt: string;
      source: { label: string; kind: string; delayed: boolean; note: string; url: string };
      rates: Record<string, number>;
      unsupported: string[];
    };
  } | null;
  error: { code: string; message: string } | null;
}

/**
 * Currency converter backed by the provider abstraction. It states the source
 * and rate date next to every result and never presents a reference fixing as a
 * live quote.
 */
export function FxConverter({ currencies }: { currencies: string[] }) {
  const [base, setBase] = React.useState("USD");
  const [quote, setQuote] = React.useState(currencies.find((code) => code !== "USD") ?? "EUR");
  const [amount, setAmount] = React.useState("1000");
  const [state, setState] = React.useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; rate: number; rateDate: string; source: string; delayed: boolean }
  >({ status: "idle" });

  const load = React.useCallback(
    async (from: string, to: string) => {
      if (from === to) {
        setState({ status: "ready", rate: 1, rateDate: "—", source: "identical currency", delayed: false });
        return;
      }
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/fx?base=${from}&symbols=${to}`, { headers: { accept: "application/json" } });
        const payload = (await response.json()) as LatestResponse;
        if (!response.ok || payload.error || !payload.data) {
          setState({ status: "error", message: payload.error?.message ?? "The provider did not return a rate." });
          return;
        }
        const latest = payload.data.latest;
        const rate = latest.rates[to];
        if (typeof rate !== "number") {
          setState({ status: "error", message: `${to} is not published by ${latest.source.label}.` });
          return;
        }
        setState({
          status: "ready",
          rate,
          rateDate: latest.rateDate,
          source: latest.source.label,
          delayed: latest.source.delayed,
        });
      } catch {
        setState({ status: "error", message: "Could not reach the FX service." });
      }
    },
    [],
  );

  React.useEffect(() => {
    void load(base, quote);
  }, [base, quote, load]);

  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= 0;
  const converted = state.status === "ready" && validAmount ? numericAmount * state.rate : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="space-y-1">
          <label htmlFor="fx-amount" className="label-xs">
            Amount
          </label>
          <Input
            id="fx-amount"
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-9 text-[13px]"
            aria-invalid={!validAmount}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="fx-base" className="label-xs">
              From
            </label>
            <select
              id="fx-base"
              value={base}
              onChange={(event) => setBase(event.target.value)}
              className="h-9 w-24 rounded-tile border border-border bg-elevated/60 px-2 text-[12.5px]"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Swap currencies"
            onClick={() => {
              setBase(quote);
              setQuote(base);
            }}
          >
            <ArrowDownUp className="size-3.5" aria-hidden="true" />
          </Button>
          <div className="space-y-1">
            <label htmlFor="fx-quote" className="label-xs">
              To
            </label>
            <select
              id="fx-quote"
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              className="h-9 w-24 rounded-tile border border-border bg-elevated/60 px-2 text-[12.5px]"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      <div className="rounded-tile border border-border/60 bg-muted/20 px-3 py-2.5">
        <p className="label-xs">Converted</p>
        <p className="num mt-1 text-[24px] font-medium leading-7">
          {state.status === "loading" ? (
            <Loader2 className="inline size-5 animate-spin text-muted-foreground" aria-label="Loading rate" />
          ) : converted !== null ? (
            <>
              {converted.toLocaleString("en-US", { maximumFractionDigits: 2 })} <span className="text-[14px]">{quote}</span>
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

      {state.status === "ready" ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          <span className="num">
            1 {base} = {state.rate.toLocaleString("en-US", { maximumFractionDigits: 6 })} {quote}
          </span>
          {" · "}
          {state.source} · rate date <span className="num">{state.rateDate}</span>
          {state.delayed ? " · delayed fixing, not a live quote" : " · live quote"}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className={cn("rounded-tile border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-[11.5px] text-risk-medium")}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
