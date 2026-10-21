import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AuthConstellation } from "@/components/auth/auth-constellation";
import { Logo } from "@/components/logo";

/**
 * Auth is the first surface a reviewer sees, so it carries the same editorial
 * register as the marketing site rather than a bare centered form: a framed
 * stage, one deep-navy rail with the claim and proof points, and a focused
 * card for the form itself.
 *
 * The rail is taller than the card on purpose. At large sizes the card aligns
 * to the top of the rail so the two read as one composed object; the leftover
 * height fills with the ambient grid instead of pushing the form around.
 */

const proofPoints = [
  { figure: "9", label: "typologies scored on every payment" },
  { figure: "100", label: "points, with the signals that made them" },
  { figure: "0", label: "scores without an audit trail" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-pill bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Skip to main content
      </a>

      {/* Ambient field: a warm wash behind the whole stage, kept very quiet. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 app-canvas opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent lg:block"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Stage top bar */}
        <header className="flex items-center justify-between pb-5 lg:pb-6">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" />
              Demo environment · synthetic data only
            </span>
            <Link
              href="/"
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Back to site
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-8">
          {/* Rail: deeper void than the page, lit violet top-right and teal
              bottom-left, with the glowing corridor constellation as its
              centre — the product's own graph, not decoration. */}
          <aside className="relative hidden overflow-hidden rounded-panel bg-[#06060D] p-10 text-[#F4F4EF] lg:flex lg:flex-col">
            <div
              aria-hidden="true"
              className="paper-grid absolute inset-0 opacity-[0.12] [background-size:40px_40px]"
            />
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-24 size-[420px] rounded-full bg-accent/30 blur-[110px]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 -left-20 size-[340px] rounded-full bg-risk-low/18 blur-[110px]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />

            <div className="relative flex flex-1 flex-col">
              <p className="flex items-center gap-2.5 text-[12px] font-medium text-[#F4F4EF]/55">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 animate-pulse-soft rounded-full bg-accent" />
                </span>
                Financial intelligence
              </p>

              <h1 className="mt-8 max-w-[17ch] font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.04em]">
                Monitoring that can explain itself.
              </h1>

              <p className="mt-5 max-w-[34ch] text-sm leading-6 text-[#F4F4EF]/65">
                Sign in to the workspace where every alert already knows which signals fired, on
                which payments, and how the case was closed.
              </p>

              {/* The glowing corridor constellation — the rail's one loud thing. */}
              <div className="flex min-h-[240px] flex-1 items-center justify-center py-6">
                <AuthConstellation className="w-full max-w-[560px]" />
              </div>

              <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                {proofPoints.map((point) => (
                  <div key={point.label}>
                    <dt className="num font-display text-2xl font-semibold tracking-[-0.03em] text-[#F4F4EF]">
                      {point.figure}
                    </dt>
                    <dd className="mt-1.5 text-[11px] leading-4 text-[#F4F4EF]/55">{point.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>

          {/* Form column */}
          <main id="main-content" className="flex flex-col">
            <div className="panel flex-1 p-6 sm:p-9 lg:p-10">
              <div className="mx-auto w-full max-w-[400px]">{children}</div>
            </div>
          </main>
        </div>

        <footer className="mt-5 flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>
            By continuing you agree to the{" "}
            <Link href="/terms" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
          <p className="num hidden sm:block">© {new Date().getFullYear()} Aegis</p>
        </footer>
      </div>
    </div>
  );
}
