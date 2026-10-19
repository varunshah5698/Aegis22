"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1400,
  className,
  startOnView = true,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  startOnView?: boolean;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [started, setStarted] = React.useState(!startOnView);
  const [display, setDisplay] = React.useState(startOnView ? 0 : value);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || !startOnView || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [startOnView]);

  React.useEffect(() => {
    if (!started) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, started, value]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
