import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";

const points = [
  "Every score ships with the signals and raw values behind it.",
  "Alerts carry an SLA clock; investigations keep their evidence.",
  "Organization-scoped database policies on every table.",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-pill bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Skip to main content
      </a>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0E0F13] p-10 text-[#F4F4EF] lg:flex">
        <div className="paper-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="lime-glow absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative">
          <Logo className="text-[#F4F4EF]" />
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">
            Monitoring that can explain itself.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-[#F4F4EF]/75">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#F0B250]" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-[#F4F4EF]/60">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>Demo environment · synthetic data only</span>
        </div>
      </aside>

      <main id="main-content" className="flex flex-col">
        <div className="flex h-20 items-center justify-between px-5 md:px-10 lg:hidden">
          <Logo />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 md:px-10">
          <div className="w-full max-w-[430px]">{children}</div>
        </div>
        <div className="px-5 pb-8 text-center text-xs text-muted-foreground md:px-10">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline decoration-accent decoration-2 underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline decoration-accent decoration-2 underline-offset-4">
            privacy policy
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
