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
    <section aria-labelledby="trust-heading" className="border-y-2 border-foreground/10 bg-card">
      <div className="container-page py-12">
        <h2 id="trust-heading" className="sr-only">
          Trusted by compliance teams and measured performance
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-6 opacity-70">
          {companies.map((company) => (
            <span key={company} className="font-display text-sm font-semibold tracking-[0.02em] text-muted-foreground">
              {company.toUpperCase()}
            </span>
          ))}
        </div>
        <dl className="mt-10 grid gap-8 border-t border-border pt-8 md:grid-cols-3">
          {trustMetrics.map((metric) => (
            <div key={metric.label}>
              <dd className="font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                <CountUp value={metric.value} prefix={"prefix" in metric ? metric.prefix : ""} suffix={metric.suffix} />
              </dd>
              <dt className="mt-2 text-sm font-medium">{metric.label}</dt>
              <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            The gap
          </p>
          <h2 id="problem-heading" className="max-w-3xl text-display-lg">
            Four patterns move illicit money across borders. Most systems catch one.
          </h2>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            How it works
          </p>
          <h2 id="how-heading" className="max-w-3xl text-display-lg">
            From payment message to defensible decision, in four steps.
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Platform
          </p>
          <h2 id="features-heading" className="max-w-3xl text-display-lg">
            Everything an analyst needs after the alert fires.
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
          <h2 id="quotes-heading" className="max-w-3xl text-display-lg">
            Compliance teams judge a system by what it can defend.
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
      <div className="rounded-hero bg-accent p-8 text-accent-foreground md:p-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="final-cta-heading" className="text-display-md">
              See your first flagged corridor in under an hour.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-accent-foreground/80">
              Load the reference dataset, score 10,000 historical payments, and compare the
              alerts against documented typologies. No integration required to start.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="bg-accent-foreground text-accent hover:bg-accent-foreground/90">
              <Link href="/signup">Start free trial</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-accent-foreground/30 text-accent-foreground hover:bg-accent-foreground/10">
              <Link href="/contact?intent=demo">Book a demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
