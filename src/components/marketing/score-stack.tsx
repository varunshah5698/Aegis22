import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Binary, Fingerprint, Gauge, History } from "lucide-react";

const layers = [
  {
    id: "signals",
    icon: Binary,
    value: "10",
    unit: "signals fired",
    label: "What fired",
    title: "Velocity, corridor, splitting, circularity, PEP",
  },
  {
    id: "context",
    icon: History,
    value: "90d",
    unit: "of baseline",
    label: "What it was compared with",
    title: "The account, corridor and entity's own past",
  },
  {
    id: "decision",
    icon: Gauge,
    value: "87",
    unit: "high risk",
    label: "The decision",
    title: "Weighted contributions, one versioned score",
  },
  {
    id: "evidence",
    icon: Fingerprint,
    value: "✓",
    unit: "signed record",
    label: "The evidence",
    title: "Raw values, model version and reviewer trail",
  },
];

/**
 * An exploded view of one alert.
 *
 * The stack is real CSS 3D, not a rendered image: each layer is a plane in a
 * shared perspective, so it can respond to hover and reduced motion without a
 * 300 KB canvas. It is the landing page's second object, deliberately quieter
 * than the globe.
 */
export function ScoreStack() {
  return (
    <section
      aria-labelledby="score-stack-heading"
      className="relative isolate scroll-mt-24 overflow-hidden bg-[#05080F] text-[#EDF1F8]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(70%_80%_at_70%_50%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/2 size-[480px] -translate-y-1/2 rounded-full bg-[#F0B250]/[0.07] blur-[120px]"
      />

      <div className="container-page relative grid items-center gap-12 py-16 md:py-20 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-8 lg:py-24">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-[#F0B250]/85">
            Anatomy of an alert
          </p>
          <h2
            id="score-stack-heading"
            className="mt-5 max-w-[13ch] scroll-mt-24 font-display text-[clamp(2.25rem,3.8vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.045em]"
          >
            A score you can take apart.
          </h2>
          <p className="mt-5 max-w-[44ch] text-[13.5px] leading-6 text-[#EDF1F8]/50">
            A number alone is not evidence. Every alert keeps the four layers that produced it —
            which signals fired, what they were compared against, how they combined, and the
            signed record of the decision.
          </p>

          <dl className="mt-8 grid max-w-[430px] grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6">
            <div>
              <dt className="text-[11px] text-white/35">
                Rule version
              </dt>
              <dd className="num mt-1 text-[13px] text-white/80">v1.0 · pinned</dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/35">
                Time to evidence
              </dt>
              <dd className="num mt-1 text-[13px] text-white/80">One screen</dd>
            </div>
          </dl>

          <Link
            href="/signup"
            className="group mt-8 inline-flex items-center gap-2 text-[12.5px] font-medium text-[#F0B250] transition-colors hover:text-[#FFC46B]"
          >
            Open an explained alert
            <ArrowUpRight
              className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className="score-stack" aria-hidden="true">
          <div className="score-stack__scene">
            <div className="score-stack__planes">
              {layers.map((layer, index) => (
                <div
                  key={layer.id}
                  className="score-stack__plane"
                  style={
                    {
                      "--i": index,
                    } as React.CSSProperties
                  }
                >
                  <div className="score-stack__plane-float">
                    <div className="score-stack__plane-face">
                      <div className="flex items-center justify-between">
                        <span className="score-stack__plane-label">{layer.label}</span>
                        <span className="score-stack__plane-index num">
                          0{layers.length - index}
                        </span>
                      </div>
                      <div className="mt-auto flex items-end gap-3">
                        <span className="score-stack__value num">{layer.value}</span>
                        <span className="score-stack__unit">{layer.unit}</span>
                        <layer.icon className="ml-auto size-5 text-[#F0B250]/70" strokeWidth={1.4} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="score-stack__badge">
              <span className="score-stack__badge-score">87</span>
              <span>
                <span className="block text-[11px] text-white/40">
                  Decision
                </span>
                <span className="block text-[10.5px] text-white/75">High risk · review in 4h</span>
              </span>
            </div>

            <div className="score-stack__beam" />
          </div>

          <ol className="score-stack__legend">
            {layers.map((layer, index) => (
              <li key={layer.id} className="flex gap-2.5 border-t border-white/10 py-2">
                <span className="num pt-px text-[9px] text-white/25">
                  0{layers.length - index}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-white/45">
                    {layer.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-white/30">
                    {layer.title}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
