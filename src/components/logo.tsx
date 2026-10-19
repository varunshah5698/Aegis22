import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Aegis mark: a shield-shaped "A" drawn with two strokes — amber for the
 * structure, teal for the crossbar. Deliberately geometric so it still reads at
 * 16px in the collapsed sidebar.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Aegis" className={cn("size-9", className)}>
      <defs>
        <linearGradient id="aegis-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#121A26" />
          <stop offset="100%" stopColor="#0A0F18" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#aegis-mark-bg)" />
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="10.5" fill="none" stroke="#F0B250" strokeOpacity="0.34" strokeWidth="1.2" />
      <path
        d="M11 28.2 20 10.6l9 17.6"
        fill="none"
        stroke="#F0B250"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.1 23.2h9.8" stroke="#2DD4BF" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="10.6" r="2.1" fill="#2DD4BF" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-offset-4", className)}
      aria-label="Aegis home"
    >
      <LogoMark />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">Aegis</span>
          <span className="mt-1 text-[8.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Financial intelligence
          </span>
        </span>
      ) : null}
    </Link>
  );
}
