import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Aegis, as a path. An aegis is a shield, and the product is a payment that
 * crosses a border — so the mark is both at once: a shield silhouette drawn as
 * one continuous route, lit amber from the origin, breaking at the border and
 * resuming teal on the far side. Two nodes, one crossing, nothing decorative.
 *
 * Geometry is tuned to survive 16px: a filled 2px harness on a dark plate, one
 * 2.6px route broken exactly at the shield edge, a solid origin dot and a
 * ringed destination. No hairlines, no fine detail to lose.
 */
const HARNESS = "M10 4.8h12.1v8.1c0 4.8-3.9 8.2-6.05 9.5C13.9 21.1 10 17.7 10 12.9Z";
const ORIGIN = { cx: 12.6, cy: 12.4 };
const DESTINATION = { cx: 26.55, cy: 12.4 };
const BORDER = 19.65;

/**
 * Shared mark paint. The gradient stops use `currentColor`, so a caller can
 * pick the hue with a text class and still get a lit gradient.
 */
function MarkPaint({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-route`} x1="12.6" y1="0" x2="26.55" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="currentColor" />
        <stop offset="51%" stopColor="currentColor" />
        <stop offset="51%" stopColor="currentColor" stopOpacity="0.7" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Aegis" className={cn("size-9", className)}>
      <MarkPaint id="aegis-mark" />
      <path
        d={HARNESS}
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeOpacity="0.72"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inside the shield, then exactly at it. The gap is the border. */}
      <path d={`M${ORIGIN.cx} ${ORIGIN.cy}h7.05`} fill="none" stroke="url(#aegis-mark-route)" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d={`M${BORDER} ${ORIGIN.cy}h6.9`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx={ORIGIN.cx} cy={ORIGIN.cy} r="5.4" fill="url(#aegis-mark-glow)" />
      <circle cx={ORIGIN.cx} cy={ORIGIN.cy} r="2" fill="currentColor" />
      <circle cx={DESTINATION.cx} cy={DESTINATION.cy} r="2.6" fill="currentColor" fillOpacity="0" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.9" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
  tone = "default",
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  /** Night surfaces sit outside the theme tokens, so the mark needs its own hue. */
  tone?: "default" | "night";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-offset-4",
        tone === "night" && "text-[#F0B250]",
        className,
      )}
      aria-label="Aegis home"
    >
      <LogoMark className={cn("size-8", tone === "night" ? "text-[#F0B250]" : "text-accent")} />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">Aegis</span>
          <span
            className={cn(
              "mt-1 text-[8.5px] font-medium uppercase tracking-[0.22em]",
              tone === "night" ? "text-white/45" : "text-muted-foreground",
            )}
          >
            Financial intelligence
          </span>
        </span>
      ) : null}
    </Link>
  );
}
