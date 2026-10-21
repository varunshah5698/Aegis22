"use client";

import * as React from "react";

import { RISK_COLORS, scoreToLevel } from "@/config/risk";
import type { CardPose, Scene } from "@/lib/risk/dossier";
import { dossierPose, projectPoint, stackLayout } from "@/lib/risk/dossier";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

/** Tracks the container size and the polite scroll progress (0 → 1). */
export function useScene(ref: React.RefObject<HTMLElement | null>) {
  const [scene, setScene] = React.useState<Scene>({ w: 760, h: 430, dist: 1100 });
  const [progress, setProgress] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setScene({
        w: rect.width,
        h: rect.height,
        dist: Math.max(760, Math.min(1250, rect.width * 0.95)),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setProgress(Math.min(1, Math.max(0, scrollTop / 320)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref]);

  return { scene, progress: reduced ? 1 : progress, reduced };
}

/* -------------------------------------------------------------------------- */
/* Card surfaces                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A card in the stack. The parallax transform is applied here per layer, so it
 * moves with the pointer independently of the authored stack layout.
 */
export function DossierCard({
  pose,
  layer,
  children,
  className,
  tone = "#2DD4BF",
  onOpen,
  index,
}: {
  pose: CardPose;
  layer: number;
  children: React.ReactNode;
  className?: string;
  tone?: string;
  onOpen?: () => void;
  index: number;
}) {
  const parallax = React.useMemo(
    () => ({
      x: (index * 4 - 2) * -1,
      y: index * 2.5,
    }),
    [index],
  );

  return (
    <div
      className="absolute left-1/2 top-0"
      style={{
        transformStyle: "preserve-3d",
        transform: `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) translate(-50%, -50%) rotateY(${pose.yaw}rad)`,
        zIndex: 20 + Math.round(pose.depth * 4),
      }}
    >
      <div style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(${layer})`, transformOrigin: "50% 50%" }}>
        <div
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (!onOpen) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className={cn(
            "dossier-card group/card relative isolate overflow-hidden rounded-[16px]",
            onOpen && "cursor-pointer",
            className,
          )}
          style={{
            // Each layer is its own perspective so the tilt reads as solid geometry.
            transform: `perspective(900px) translateZ(0)`,
            ["--card-tone" as string]: tone,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[16px]"
            style={{
              background: `linear-gradient(145deg, rgb(255 255 255 / 0.06), transparent 42%), radial-gradient(120% 90% at 8% 0%, ${tone}1f, transparent 62%)`,
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[16px] transition-opacity duration-500"
            style={{
              background: `radial-gradient(70% 60% at 20% 100%, ${tone}22, transparent 70%)`,
              opacity: 0.8,
            }}
          />
          <span aria-hidden="true" className="dossier-sheen pointer-events-none absolute inset-0 rounded-[16px]" />
          <div className="relative flex h-full flex-col p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

export function CardEyebrow({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <p
      className="font-mono text-[11px] font-medium"
      style={{ color: tone ?? "rgb(var(--muted-foreground) / 0.85)" }}
    >
      {children}
    </p>
  );
}

/** Big value with the unit set apart, the way a ticket or a gauge is typeset. */
export function CardValue({
  value,
  unit,
  size = "lg",
  tone,
}: {
  value: string;
  unit?: string;
  size?: "lg" | "md";
  tone?: string;
}) {
  return (
    <p className="flex items-baseline gap-2">
      <span
        className={cn(
          "num font-medium leading-none tracking-[-0.05em]",
          size === "lg" ? "text-[clamp(38px,6vw,58px)]" : "text-[clamp(26px,3.6vw,38px)]",
        )}
        style={{ color: tone ?? "rgb(var(--foreground))" }}
      >
        {value}
      </span>
      {unit ? (
        <span className="label-xs translate-y-[-2px] max-w-[11ch] leading-3">{unit}</span>
      ) : null}
    </p>
  );
}

export function Sprint({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-gradient-to-r from-border-strong via-border-strong/50 to-transparent", className)} />;
}

/* -------------------------------------------------------------------------- */
/* Score dial (animated, 3D)                                                  */
/* -------------------------------------------------------------------------- */

export function ScoreSphere({ score, explode }: { score: number; explode: number }) {
  const level = scoreToLevel(score);
  const color = RISK_COLORS[level];
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ transform: `rotateY(${explode * -42}deg) rotateX(${explode * 16}deg)`, transformStyle: "preserve-3d" }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -z-10 rounded-full blur-2xl" style={{ background: color, opacity: 0.18 + explode * 0.22 }} />
      <svg viewBox="0 0 120 120" className="size-[112px] -rotate-90">
        <circle cx="60" cy="60" r="58" fill="none" stroke="rgb(var(--foreground) / 0.06)" strokeWidth="0.6" strokeDasharray="1 3" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--muted))" strokeWidth="3" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[30px] font-medium leading-none tracking-[-0.04em]">{Math.round(score)}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{level}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Caption cells                                                              */
/* -------------------------------------------------------------------------- */

export function CaptionCell({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-border-strong/60 pt-2.5">
      <p className="flex items-baseline gap-2">
        <span className="num text-[11px] text-muted-foreground/70">{index}</span>
        <span className="label-xs truncate">{title}</span>
      </p>
      <div className="mt-1.5 text-[12px] leading-4 text-muted-foreground">{children}</div>
    </div>
  );
}

export function ProjectionBars({ layers }: { layers: number[] }) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 flex items-end gap-1" aria-hidden="true">
      {layers.map((layer, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-foreground/25 transition-all duration-500"
          style={{ height: `${Math.max(4, Math.min(24, layer * 14))}px`, opacity: 0.35 + Math.max(0, 1 - index * 0.25) }}
        />
      ))}
    </div>
  );
}

export type { CardPose };
export { dossierPose, projectPoint, stackLayout };
