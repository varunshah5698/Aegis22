"use client";

import * as React from "react";
import { ArrowLeftRight, Clock3, Info, Loader2, Sparkles } from "lucide-react";

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
 * a live quote. The panel is layered like the rest of the workspace: a lit
 * face, an extruded result slab and a provenance strip pinned to the bottom.
 */
export function FxConverter({ currencies }: { currencies: string[] }) {
  const [base, setBase] = React.useState("USD");
  const [quote, setQuote] = React.useState(currencies.find((code) => code !== "USD") ?? "EUR");
  const [amount, setAmount] = React.useState("1000");
  const [swapped, setSwapped] = React.useState(false);
  const [state, setState] = React.useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; rate: number; rateDate: string; fetchedAt: string; source: string; delayed: boolean }
  >({ status: "idle" });

  const load = React.useCallback(
    async (from: string, to: string) => {
      if (from === to) {
        setState({
          status: "ready",
          rate: 1,
          rateDate: "—",
          fetchedAt: new Date().toISOString(),
          source: "identical currency",
          delayed: false,
        });
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
          fetchedAt: latest.fetchedAt,
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

  const swap = () => {
    setBase(quote);
    setQuote(base);
    setSwapped((value) => !value);
  };

  return (
    <div className="relative overflow-hidden rounded-panel border border-border/70 bg-card shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_26px_60px_-45px_rgb(0_0_0/0.65)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_8%_0%,rgb(var(--accent)/0.09),transparent_60%)]"
      />

      <div className="relative space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor="fx-amount" className="label-xs">
            Amount
          </label>
          <Input
            id="fx-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="num h-11 text-[17px] font-semibold tracking-[-0.01em]"
            aria-invalid={!validAmount}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="fx-base" className="label-xs">
              From
            </label>
            <select
              id="fx-base"
              value={base}
              onChange={(event) => setBase(event.target.value)}
              className="num h-11 w-full appearance-none rounded-tile border border-border bg-elevated/60 px-3 text-[13px] font-medium"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={swap}
            aria-label="Swap currencies"
            className={cn(
              "group mb-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent transition-colors hover:border-accent/60 hover:bg-accent/20",
            )}
          >
            <ArrowLeftRight
              className={cn("size-4 transition-transform duration-300", swapped ? "rotate-180" : "")}
              aria-hidden="true"
            />
          </button>

          <div className="space-y-1.5">
            <label htmlFor="fx-quote" className="label-xs">
              To
            </label>
            <select
              id="fx-quote"
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              className="num h-11 w-full appearance-none rounded-tile border border-border bg-elevated/60 px-3 text-[13px] font-medium"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-tile border border-accent/25 bg-[linear-gradient(180deg,rgb(var(--accent)/0.10),rgb(var(--accent)/0.02))] px-4 py-3.5">
          <p className="label-xs inline-flex items-center gap-1.5">
            <Sparkles className="size-3 text-accent" aria-hidden="true" />
            Converted
          </p>
          <p className="num mt-1.5 text-[30px] font-semibold leading-9 tracking-[-0.02em]">
            {state.status === "loading" ? (
              <Loader2 className="inline size-6 animate-spin text-muted-foreground" aria-label="Loading rate" />
            ) : converted !== null ? (
              <>
                {converted.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                <span className="text-[15px] font-medium text-accent">{quote}</span>
              </>
            ) : (
              "—"
            )}
          </p>
          {state.status === "ready" ? (
            <p className="num mt-1 text-[11.5px] text-muted-foreground">
              1 {base} = {state.rate.toLocaleString("en-US", { maximumFractionDigits: 6 })} {quote}
              {base !== quote ? " · cross rate from the published fixing" : ""}
            </p>
          ) : null}
        </div>
      </div>

      {state.status === "error" ? (
        <p className="relative mx-4 mb-4 rounded-tile border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-[11.5px] text-risk-medium">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] leading-4 text-muted-foreground">
          <span className="num inline-flex items-center gap-1.5">
            <Clock3 className="size-3" aria-hidden="true" />
            fixing <span className="text-foreground/80">{state.rateDate}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="num">
            fetched <span className="text-foreground/80">{state.fetchedAt.slice(11, 19)} UTC</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Info className="size-3" aria-hidden="true" />
            {state.source}
          </span>
          <span className="ml-auto">
            {state.delayed ? "delayed fixing, not a live quote" : "live quote"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
