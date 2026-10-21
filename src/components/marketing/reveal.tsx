"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Fade-up on scroll, once. Implemented with IntersectionObserver instead of an
 * animation library so the landing page ships less client JavaScript; CSS
 * already disables the transition under prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string | undefined;
  delay?: number | undefined;
  as?: "div" | "section" | "li" | undefined;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const classes = cn(
    "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
    shown
      ? "in-view translate-y-0 opacity-100"
      : "translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
    className,
  );
  const style = { transitionDelay: shown ? `${delay}ms` : "0ms" };

  if (as === "li") {
    return (
      <li ref={ref as React.Ref<HTMLLIElement>} data-reveal="" className={classes} style={style}>
        {children}
      </li>
    );
  }
  if (as === "section") {
    return (
      <section ref={ref as React.Ref<HTMLElement>} data-reveal="" className={classes} style={style}>
        {children}
      </section>
    );
  }
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} data-reveal="" className={classes} style={style}>
      {children}
    </div>
  );
}
