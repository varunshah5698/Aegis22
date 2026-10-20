import Link from "next/link";
import {
  ArrowRight,
  Braces,
  CircleDollarSign,
  FileText,
  GitBranch,
  Landmark,
  Layers,
  ScanSearch,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

import { CountUp } from "@/components/marketing/count-up";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { features, problems, steps, testimonials, trustMetrics } from "@/content/marketing";
import { cn } from "@/lib/utils";

export function TrustStrip() {
  const companies = ["Northwind Payments", "Meridian Trust", "Halcyon Financial", "Ardent Bank", "Solstice Capital"];

  return (
    <section
      aria-labelledby="trust-heading"
      className="border-b border-white/[0.06] bg-[#05080F] text-[#EDF1F8]"
    >
      <div className="container-page py-10 md:py-12">
        <h2 id="trust-heading" className="sr-only">
          Trusted by compliance teams and measured performance
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          {companies.map((company) => (
            <span
              key={company}
              className="text-[11.5px] font-medium text-white/30"
            >
              {company}
            </span>
          ))}
        </div>
        <dl className="mt-8 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-3">
          {trustMetrics.map((metric) => (
            <div key={metric.label}>
              <dd className="num font-display text-4xl font-medium tracking-[-0.04em] text-white/95 md:text-[44px]">
                <CountUp value={metric.value} prefix={"prefix" in metric ? metric.prefix : ""} suffix={metric.suffix} />
              </dd>
              <dt className="mt-2 text-[12px] font-medium text-white/80">{metric.label}</dt>
              <p className="mt-1 text-[11px] leading-4 text-white/35">{metric.detail}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ProblemVisual({ id }: { id: (typeof problems)[number]["id"] }) {
  if (id === "flows") {
    return (
      <div className="flex h-16 items-end gap-1" aria-hidden="true">
        {[12, 14, 11, 13, 12, 48, 52, 46].map((height, index) => (
          <div
            key={index}
            className={cn("flex-1 rounded-t", index > 4 ? "bg-risk-high" : "bg-foreground/20")}
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    );
  }
  if (id === "intermediaries") {
    return (
      <div className="flex h-16 items-center justify-between gap-1 text-[10px] text-muted-foreground" aria-hidden="true">
        <span className="rounded-lg bg-foreground/10 px-2 py-1">Inbound</span>
        <ArrowRight className="size-3" />
        <span className="rounded-lg bg-risk-high/15 px-2 py-1 text-risk-high">Shell</span>
        <ArrowRight className="size-3" />
        <span className="rounded-lg bg-foreground/10 px-2 py-1">91% out</span>
      </div>
    );
  }
  if (id === "splitting") {
    return (
      <div className="relative flex h-16 items-end gap-1.5" aria-hidden="true">
        <div className="absolute inset-x-0 top-1 border-t border-dashed border-risk-critical/60" />
        {[28, 30, 29, 31, 30, 29, 31].map((height, index) => (
          <div key={index} className="flex-1 rounded-t bg-accent" style={{ height: `${height}px` }} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-16 items-center justify-center gap-2 text-[11px] text-muted-foreground" aria-hidden="true">
      {["A", "B", "C"].map((node, index) => (
        <span key={node} className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-risk-critical/50 font-mono text-risk-critical">
            {node}
          </span>
          {index < 2 ? <ArrowRight className="size-3" /> : null}
        </span>
      ))}
      <span className="ml-1 text-risk-critical">→ A</span>
    </div>
  );
}

export function ProblemGrid() {
  return (
    <section id="product" aria-labelledby="problem-heading" className="section-pad scroll-mt-24">
      <div className="container-page">
        <Reveal>
          <p className="section-kicker mb-4">
            The gap
          </p>
          <h2 id="problem-heading" className="display-section max-w-[26ch]">
            Four patterns move dirty money across borders. Most systems <em>catch one</em>.
          </h2>
          <p className="type-lede mt-5">
            Each one is invisible to a rule that inspects a single payment in isolation. Aegis
            looks at the payment, the accounts around it, and the days that came before.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {problems.map((problem, index) => (
            <Reveal key={problem.id} delay={index * 60}>
              <article className="card-positivus h-full">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold tracking-tight">{problem.title}</h3>
                  <div className="text-right">
                    <p className="num text-sm font-semibold">{problem.stat}</p>
                    <p className="text-[11px] text-muted-foreground">{problem.statLabel}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{problem.body}</p>
                <div className="mt-6">
                  <ProblemVisual id={problem.id} />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const stepIcons = [Workflow, ScanSearch, Braces, ShieldCheck];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="section-pad scroll-mt-24 border-y-2 border-foreground/10 bg-card">
      <div className="container-page">
        <Reveal>
          <p className="section-kicker mb-4">
            How it works
          </p>
          <h2 id="how-heading" className="display-section max-w-[24ch]">
            A payment message becomes a <em>defensible decision</em> in four steps.
          </h2>
        </Reveal>

        <div className="relative mt-12">
          <div className="absolute left-0 right-0 top-7 hidden border-t-2 border-dashed border-foreground/15 lg:block" aria-hidden="true" />
          <ol className="grid gap-8 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = stepIcons[index]!;
              return (
                <Reveal as="li" key={step.title} delay={index * 80} className="relative">
                  <div className="flex size-14 items-center justify-center rounded-full border-2 border-foreground bg-accent text-accent-foreground">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <p className="num mt-4 text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  <p className="mt-3 rounded-pill bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    {step.detail}
                  </p>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

const featureIcons: Record<string, typeof ScanSearch> = {
  scoring: CircleDollarSign,
  explainability: Braces,
  network: GitBranch,
  rules: Layers,
  cases: Users,
  reporting: FileText,
};

export function FeatureGrid() {
  return (
    <section id="features" aria-labelledby="features-heading" className="section-pad scroll-mt-24">
      <div className="container-page">
        <Reveal>
          <p className="section-kicker mb-4">
            Platform
          </p>
          <h2 id="features-heading" className="display-section max-w-[24ch]">
            Everything an analyst needs <em>after</em> the alert fires.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = featureIcons[feature.id] ?? Landmark;
            return (
              <Reveal key={feature.id} delay={index * 50}>
                <article className="card-positivus flex h-full flex-col">
                  <div className="flex size-11 items-center justify-center rounded-card bg-foreground text-background">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                  <Link
                    href={feature.href}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-medium underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground"
                  >
                    Learn more <span className="sr-only">about {feature.title}</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section aria-labelledby="quotes-heading" className="section-pad border-y-2 border-foreground/10 bg-card">
      <div className="container-page">
        <Reveal>
          <h2 id="quotes-heading" className="display-section max-w-[22ch]">
            Compliance teams judge a system by what it can <em>defend</em>.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map((quote, index) => (
            <Reveal key={quote.name} delay={index * 70}>
              <figure className="flex h-full flex-col rounded-hero border border-border bg-background p-6">
                <blockquote className="flex-1 text-sm leading-6 text-foreground/90">“{quote.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground"
                  >
                    {quote.name.split(" ").map((part) => part[0]).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{quote.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.role}, {quote.company}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className="container-page section-pad">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#05080F] p-8 text-[#EDF1F8] md:p-12 lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(90%_100%_at_80%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-[380px] rounded-full bg-[#F0B250]/[0.12] blur-[100px]"
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[11.5px] font-medium text-[#F0B250]/85">
              Start with the reference set
            </p>
            <h2 id="final-cta-heading" className="display-section mt-4 max-w-[20ch] text-[#F4F7FC]">
              Your first flagged corridor, in <em>under an hour</em>.
            </h2>
            <p className="mt-5 max-w-xl text-[14px] leading-[1.65] text-[#EDF1F8]/50">
              Open the reference dataset, follow one payment from signal to alert, then compare the
              finding against the typology that caught it. Nothing to integrate, nothing to import.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
            <Button asChild size="lg" className="bg-[#F0B250] text-[#0B0F17] hover:bg-[#FFC46B]">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/15 text-white/80 hover:bg-white/[0.07] hover:text-white"
            >
              <Link href="/contact?intent=demo">Book a demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
