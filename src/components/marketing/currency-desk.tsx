"use client";

import * as React from "react";
import { ArrowLeftRight, Clock3, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* AI currency desk — the landing page's live converter object                  */
/* -------------------------------------------------------------------------- */

export interface DeskSeries {
  /** Daily USD fixings for one quote currency, oldest first. */
  points: Array<{ date: string; rate: number }>;
}

export interface CurrencyDeskProps {
  /** null when the provider could not be reached — the desk stays honest. */
  rates: Record<string, number> | null;
  series: Record<string, DeskSeries>;
  currencies: string[];
  rateDate: string;
  /** ISO timestamp the server fetched the fixing at. */
  fetchedAt: string;
  sourceLabel: string;
  sourceNote: string;
}

const QUICK_PAIRS: Array<[string, string]> = [
  ["USD", "EUR"],
  ["USD", "GBP"],
  ["USD", "INR"],
  ["USD", "JPY"],
];

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(date);
}

function formatAmount(value: number): string {
  const digits = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** Window statistics for a pair, straight from the fixings — no interpolation. */
function pairStats(points: Array<{ date: string; rate: number }>) {
  if (points.length === 0) return null;
  const ratios = points.map((point) => point.rate);
  const last = ratios[ratios.length - 1]!;
  const first = ratios[0]!;
  const mean = ratios.reduce((total, value) => total + value, 0) / ratios.length;
  const change30d = first > 0 ? (last / first - 1) * 100 : null;
  const vsMean = mean > 0 ? (last / mean - 1) * 100 : null;
  return { last, change30d, vsMean, windowStart: points[0]!.date };
}

function Sparkline({ points, className }: { points: Array<{ rate: number }>; className?: string }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - ((value - min) / span) * 22 - 2;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="desk-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0B250" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F0B250" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 100 26 L 0 26 Z`} fill="url(#desk-spark)" />
      <path d={path} fill="none" stroke="#F0B250" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The landing page converter. Real CSS 3D — the console is a plane in a shared
 * perspective that levels out under the cursor, with an extruded back plate for
 * depth, so it reads as an object rather than a flat form. Every figure on it
 * comes from the published fixings: the converting rate, the 30-day shape and
 * the analyst note are all computed from the same data the workspace uses, and
 * the fixing date and source stay printed on the face.
 */
export function CurrencyDesk({ rates, series, currencies, rateDate, fetchedAt, sourceLabel, sourceNote }: CurrencyDeskProps) {
  const [amount, setAmount] = React.useState("1000");
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState(currencies.find((code) => code !== "USD") ?? "EUR");
  const [now, setNow] = React.useState<Date | null>(null);
  const [swapped, setSwapped] = React.useState(false);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pairSeries = series[to]?.points ?? [];
  const stats = pairStats(pairSeries);

  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= 0;

  let unitRate: number | null = null;
  let converted: number | null = null;
  if (rates) {
    const fromRate = from === "USD" ? 1 : rates[from];
    const toRate = to === "USD" ? 1 : rates[to];
    if (typeof fromRate === "number" && typeof toRate === "number" && fromRate > 0) {
      unitRate = toRate / fromRate;
      if (validAmount) converted = numericAmount * unitRate;
    }
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSwapped((value) => !value);
  };

  return (
    <div className="[perspective:1400px]">
      <div className="relative [transform-style:preserve-3d] [transform:rotateX(5deg)_rotateY(-7deg)] transition-transform duration-500 ease-out hover:[transform:rotateX(0deg)_rotateY(0deg)] motion-reduce:[transform:none]">
        {/* Extruded plate: a second plane behind the face, visible at the edges. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[26px] border border-[#F0B250]/14 bg-[#0A0F1A] [transform:translateZ(-30px)_translateY(10px)]"
        />
        <div className="relative overflow-hidden rounded-[26px] border border-[#F0B250]/25 bg-[#080C14]/95 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_60px_120px_-60px_rgb(0_0_0/0.95),0_0_90px_-50px_rgb(240_178_80/0.55)] backdrop-blur">
          {/* light spill across the face */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_12%_0%,rgb(240_178_80/0.13),transparent_58%),radial-gradient(70%_80%_at_100%_100%,rgb(45_212_191/0.08),transparent_60%)]"
          />

          <div className="relative grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
            {/* controls ------------------------------------------------------ */}
            <div className="border-b border-white/[0.07] p-6 md:border-b-0 md:border-r md:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F0B250]">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Rate desk
                </span>
                <span className="num inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/55">
                  <Clock3 className="size-3" aria-hidden="true" />
                  {now ? `${formatClock(now)} UTC` : "— UTC"}
                </span>
              </div>

              <label htmlFor="desk-amount" className="mt-5 block text-[11px] uppercase tracking-[0.14em] text-white/45">
                Amount
              </label>
              <input
                id="desk-amount"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={!validAmount}
                className="num mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 font-display text-[26px] font-semibold tracking-[-0.02em] text-white outline-none transition-colors placeholder:text-white/25 focus-visible:border-[#F0B250]/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
              />

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                <div className="min-w-0">
                  <label htmlFor="desk-from" className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                    From
                  </label>
                  <select
                    id="desk-from"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-2 h-11 w-full appearance-none rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[13px] font-medium text-white/90 outline-none transition-colors focus-visible:border-[#F0B250]/60"
                  >
                    {currencies.map((code) => (
                      <option key={code} value={code} className="bg-[#0B111C] text-white/90">
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap currencies"
                  className="group mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border border-[#F0B250]/30 bg-[#F0B250]/10 text-[#F0B250] transition-all duration-300 hover:border-[#F0B250]/70 hover:bg-[#F0B250]/20"
                >
                  <ArrowLeftRight
                    className={cn("size-4 transition-transform duration-300", swapped ? "rotate-180" : "")}
                    aria-hidden="true"
                  />
                </button>

                <div className="min-w-0">
                  <label htmlFor="desk-to" className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                    To
                  </label>
                  <select
                    id="desk-to"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-2 h-11 w-full appearance-none rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[13px] font-medium text-white/90 outline-none transition-colors focus-visible:border-[#F0B250]/60"
                  >
                    {currencies.map((code) => (
                      <option key={code} value={code} className="bg-[#0B111C] text-white/90">
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {QUICK_PAIRS.filter(([pairFrom, pairTo]) => currencies.includes(pairTo) && (pairFrom === "USD" || currencies.includes(pairFrom))).map(
                  ([pairFrom, pairTo]) => {
                    const active = from === pairFrom && to === pairTo;
                    return (
                      <button
                        key={`${pairFrom}-${pairTo}`}
                        type="button"
                        onClick={() => {
                          setFrom(pairFrom);
                          setTo(pairTo);
                        }}
                        className={cn(
                          "num rounded-full border px-2.5 py-1 text-[10.5px] transition-colors",
                          active
                            ? "border-[#F0B250]/60 bg-[#F0B250]/15 text-[#F5C97A]"
                            : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white/80",
                        )}
                      >
                        {pairFrom} → {pairTo}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* result ------------------------------------------------------- */}
            <div className="relative flex flex-col justify-between gap-5 p-6 md:p-7">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Converted at the fixing</p>
                {rates === null ? (
                  <p className="mt-3 inline-flex items-start gap-2 rounded-xl border border-[#F0B250]/30 bg-[#F0B250]/10 px-3 py-2 text-[12px] leading-5 text-[#F5C97A]">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    Reference rates are unavailable right now. The desk stays blank rather than inventing a number.
                  </p>
                ) : unitRate === null ? (
                  <p className="mt-3 text-[12px] leading-5 text-white/50">
                    {to} is not published by {sourceLabel.split(" ")[0]}, so no cross rate is shown.
                  </p>
                ) : (
                  <>
                    <p className="num mt-2 font-display text-[clamp(2rem,4.4vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
                      {converted === null ? (
                        <Loader2 className="size-7 animate-spin text-[#F0B250]" aria-label="Loading rate" />
                      ) : (
                        <>
                          {formatAmount(converted)}{" "}
                          <span className="text-[0.5em] font-medium text-[#F0B250]">{to}</span>
                        </>
                      )}
                    </p>
                    <p className="num mt-1.5 text-[12.5px] text-white/55">
                      1 {from} = {formatAmount(unitRate)} {to}
                      {from !== "USD" && to !== "USD" ? " · cross rate from the USD fixing" : ""}
                    </p>
                  </>
                )}
              </div>

              {/* the pair's own 30-day shape, from the same fixings */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="num text-[11.5px] text-white/60">USD/{to} · 30 days</p>
                  {stats?.change30d !== null && stats?.change30d !== undefined ? (
                    <p className={cn("num text-[11.5px] font-medium", stats.change30d >= 0 ? "text-[#4ADE9A]" : "text-[#F4726E]")}>
                      {stats.change30d >= 0 ? "+" : ""}
                      {stats.change30d.toFixed(2)}%
                    </p>
                  ) : null}
                </div>
                {pairSeries.length >= 2 ? (
                  <Sparkline points={pairSeries} className="mt-2 h-9 w-full" />
                ) : (
                  <p className="mt-2 text-[11px] text-white/35">Not enough fixings in the window to draw a trend.</p>
                )}
              </div>

              {/* the analyst note, computed from the window — never improvised */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06] px-3.5 py-2.5">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#2DD4BF]" aria-hidden="true" />
                <p className="text-[11.5px] leading-[1.6] text-white/70">
                  {stats && stats.vsMean !== null ? (
                    <>
                      USD/{to} is trading{" "}
                      <span className="num font-medium text-white">
                        {Math.abs(stats.vsMean).toFixed(2)}% {stats.vsMean >= 0 ? "above" : "below"}
                      </span>{" "}
                      its 30-day mean fixing ({formatDate(stats.windowStart)}–{formatDate(rateDate)}). The workspace scores
                      payments at this same published rate, never a live quote.
                    </>
                  ) : (
                    <>The workspace scores payments at the published fixing, never a live quote.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* provenance strip ------------------------------------------------ */}
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.07] bg-white/[0.02] px-6 py-3 text-[11px] text-white/45 md:px-7">
            <span className="num">
              Fixing for <span className="text-white/75">{rateDate}</span>
            </span>
            <span aria-hidden="true" className="hidden text-white/20 sm:inline">
              ·
            </span>
            <span className="num">
              Fetched <span className="text-white/75">{new Date(fetchedAt).toISOString().slice(11, 19)} UTC</span>
            </span>
            <span aria-hidden="true" className="hidden text-white/20 sm:inline">
              ·
            </span>
            <span>{sourceLabel}</span>
            <span aria-hidden="true" className="hidden text-white/20 sm:inline">
              ·
            </span>
            <span className="max-w-[46ch] truncate" title={sourceNote}>
              {sourceNote}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
