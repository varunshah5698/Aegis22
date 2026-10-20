"use client";

import * as React from "react";
import { ArrowUpRight, Fingerprint, Layers, ScanLine, Sparkles } from "lucide-react";

import {
  CardEyebrow,
  CardValue,
  CaptionCell,
  DossierCard,
  ScoreSphere,
  Sprint,
  useScene,
} from "@/components/dashboard/decision-dossier";
import { dossierPose, stackLayout, type CardPose } from "@/lib/risk/dossier";
import { cn } from "@/lib/utils";

export interface DossierData {
  score: number;
  color: string;
  thresholdCrossed: boolean;
  modelVersion: string;
  corridor: string;
  corridorNote: string;
  counterparties: string;
  channel: string;
  amount: string;
  amountUnit: string;
  amountInUsd: string;
  amountNote: string;
  points: string;
  contribution: string;
  share: string;
  signalsFired: string;
  signalCount: number;
  topSignal: string;
  weight: string;
  peakPoints: string;
  timing: string;
  alertsLabel: string;
  alertsNote: string;
  decision: { code: string; headline: string; detail: string; tone: "clear" | "review" | "block" };
  moment: string;
}

const DECISION_TONE: Record<string, string> = {
  clear: "#2DD4BF",
  review: "#F0B250",
  block: "#F45E5E",
};

export function DecisionDossierHero({ data }: { data: DossierData }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scene, progress } = useScene(ref);

  const poses = React.useMemo<CardPose[]>(
    () => [0, -1, -2, -3, -4].map((index) => dossierPose(index, progress, scene)),
    [progress, scene],
  );
  const layout = React.useMemo(() => stackLayout(poses, scene), [poses, scene]);
  const headPose = poses[0] ?? { x: 0, y: 0, z: 0, depth: 0, yaw: 0 };
  const [expanded, setExpanded] = React.useState(false);
  const scoreColor = data.color;

  const cards = {
    score: (
      <>
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Score</CardEyebrow>
          <ScanLine className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <div className="mt-4">
          <CardValue value={String(Math.round(data.score))} unit="/100" tone={data.color} />
        </div>
        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
          {data.thresholdCrossed ? "Cleared the alert cutoff" : "Stayed under the alert cutoff"} {"·"} model{" "}
          <span className="num text-foreground/80">{data.modelVersion}</span>
        </p>
        <div className="mt-auto pt-4">
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, data.score))}%`, background: scoreColor, boxShadow: `0 0 10px ${scoreColor}99` }}
            />
            <span className="absolute inset-y-[-3px] w-px bg-foreground/70" style={{ left: "60%" }} />
          </div>
          <p className="mt-1.5 flex justify-between text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>0</span>
            <span>alert at 60</span>
            <span>100</span>
          </p>
        </div>
      </>
    ),
    amount: (
      <>
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Amount</CardEyebrow>
          <span className="chip h-5 px-1.5 text-[9.5px] leading-none">{data.amount.includes("USD") ? "base" : "converted"}</span>
        </div>
        <div className="mt-4">
          <CardValue value={data.amount} unit={data.amountUnit} size="md" />
        </div>
        <p className="num mt-2 text-[11px] text-muted-foreground">{data.amountInUsd} in USD</p>
        <p className="mt-auto pt-4 text-[10.5px] leading-4 text-muted-foreground">{data.amountNote}</p>
      </>
    ),
    corridor: (
      <>
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Corridor</CardEyebrow>
          <span className="font-mono text-[9.5px] text-muted-foreground/70">{data.channel}</span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-[clamp(30px,4.6vw,44px)] font-medium leading-none tracking-[-0.04em]">{data.corridor}</span>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{data.corridorNote}</p>
        <div className="mt-auto pt-4">
          <Sprint />
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{data.counterparties}</p>
        </div>
      </>
    ),
    signal: (
      <>
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Signals</CardEyebrow>
          <Layers className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <div className="mt-4">
          <CardValue value={data.signalsFired} unit={data.signalCount > 0 ? `of ${data.signalCount} fired` : "no signals stored"} />
        </div>
        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
          Largest contribution: <span className="text-foreground/85">{data.topSignal}</span>
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          {[
            { label: "weight", value: data.weight },
            { label: "points", value: data.peakPoints },
          ].map((cell) => (
            <div key={cell.label} className="rounded-tile border border-border/70 bg-background/40 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{cell.label}</p>
              <p className="num mt-0.5 text-[13px]">{cell.value}</p>
            </div>
          ))}
        </div>
      </>
    ),
    scoreDetail: (
      <>
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>The evidence</CardEyebrow>
          <Fingerprint className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">points</p>
            <p className="num mt-0.5 text-[22px] leading-none">{data.points}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">contribution</p>
            <p className="num mt-0.5 text-[22px] leading-none">{data.contribution}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{data.share}</p>
        <p className="mt-auto pt-4 text-[10.5px] leading-4 text-muted-foreground">{data.timing}</p>
      </>
    ),
  };

  const onClick = () => setExpanded((value) => !value);

  return (
    <section aria-label="Decision dossier" className="dossier dossie-hero relative">
      <div className="relative overflow-hidden rounded-hero border border-border/70 bg-gradient-to-b from-[rgb(var(--elevated))] to-[rgb(var(--card))]">
        <div aria-hidden="true" className="dossier-grid pointer-events-none absolute inset-0 opacity-[0.55]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-700"
          style={{
            background: `radial-gradient(closest-side, ${scoreColor}26, transparent)`,
            opacity: 0.6 + progress * 0.4,
          }}
        />

        <div
          ref={ref}
          className="relative h-[clamp(320px,40vw,430px)] [transform-style:preserve-3d]"
          style={{ perspective: `${scene.dist}px`, perspectiveOrigin: "50% 50%" }}
        >
          {/* Stacked cards behind the headline, drawn outermost-last. */}
          {(
            [
              { key: "corridor", face: cards.corridor, pose: poses[4], tone: "#93C5FD" },
              { key: "signal", face: cards.signal, pose: poses[3], tone: "#F0B250" },
              { key: "amount", face: cards.amount, pose: poses[2], tone: "#93C5FD" },
              { key: "scoreDetail", face: cards.scoreDetail, pose: poses[1], tone: scoreColor },
            ] as const
          ).map((entry, index) => (
            <DossierCard
              key={entry.key}
              index={4 - index}
              pose={entry.pose ?? headPose}
              layer={layout.layers[4 - index] ?? 1}
              tone={entry.tone}
              onOpen={onClick}
              className="w-[clamp(240px,30vw,340px)]"
            >
              {entry.face}
            </DossierCard>
          ))}

          {/* Headline card: the one that lifts out of the deck. */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate3d(${layout.card.translate[0]}px, ${layout.card.translate[1]}px, 0) scale(${layout.card.scale}) rotateY(${layout.card.rotateY}rad)`,
              transformOrigin: "0 0",
              zIndex: 40,
            }}
          >
            <DossierCard
              index={0}
              pose={headPose}
              layer={layout.layers[0] ?? 1}
              tone={scoreColor}
              onOpen={() => setExpanded((value) => !value)}
              className="w-[clamp(280px,34vw,390px)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardEyebrow tone={scoreColor}>Decision dossier</CardEyebrow>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">score · {data.modelVersion}</p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-full border border-border/80 bg-background/50">
                  <Sparkles className="size-3.5" style={{ color: scoreColor }} aria-hidden="true" />
                </span>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <ScoreSphere score={data.score} explode={progress} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: DECISION_TONE[data.decision.tone] }} aria-hidden="true" />
                    <span className="label-xs">Decision</span>
                  </p>
                  <p className="mt-1 font-display text-[19px] font-medium leading-tight tracking-[-0.02em]">{data.decision.headline}</p>
                  <p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">{data.decision.detail}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                {[
                  { label: "points", value: data.points },
                  { label: "amount", value: data.amountInUsd.replace(/\.00/, "") },
                  { label: "alerts", value: data.alertsLabel },
                ].map((cell) => (
                  <div key={cell.label} className="min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{cell.label}</p>
                    <p className="num mt-1 truncate text-[13px]">{cell.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-auto flex items-center gap-1 pt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover/card:text-foreground">
                {expanded ? "Close the breakdown" : "Tap for the maths"}
                <ArrowUpRight className={cn("size-3 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
              </p>
            </DossierCard>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-risk-low" aria-hidden="true" />
              Live decision staging
            </span>
            <span className="num">{data.moment}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border/80 bg-background/50 px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-foreground/25 hover:bg-background"
            aria-expanded={expanded}
          >
            {expanded ? "Hide the breakdown" : "Open the breakdown"}
            <ArrowUpRight className={cn("size-3 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-x-6 gap-y-4 transition-all duration-500 sm:grid-cols-2 xl:grid-cols-4",
          expanded ? "mt-5 opacity-100" : "mt-4 opacity-90",
        )}
      >
        <CaptionCell index="01" title="What fired">
          <span className="text-foreground/85">{data.signalsFired}</span> of {data.signalCount} stored signals crossed the cutoff.{" "}
          {data.signalCount > 0 ? (
            <>
              <span className="text-foreground/85">{data.topSignal}</span> carried the most weight.
            </>
          ) : null}
        </CaptionCell>
        <CaptionCell index="02" title="What it was compared with">
          <span className="num text-foreground/85">{data.corridor}</span> {"·"} {data.corridorNote}
        </CaptionCell>
        <CaptionCell index="03" title="How the score was built">
          <span className="num text-foreground/85">{data.points}</span> points from weighted signals over a{" "}
          <span className="num text-foreground/85">{data.weight}</span> normaliser.
        </CaptionCell>
        <CaptionCell index="04" title="Next action">
          <span style={{ color: DECISION_TONE[data.decision.tone] }}>{data.decision.code}</span>
          {" · "}
          {data.alertsNote}
        </CaptionCell>
      </div>
    </section>
  );
}
