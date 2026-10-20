import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { FaqSection } from "@/components/marketing/faq-section";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { RiskGlobe } from "@/components/marketing/risk-globe";
import {
  FeatureGrid,
  FinalCta,
  HowItWorks,
  ProblemGrid,
  Testimonials,
  TrustStrip,
} from "@/components/marketing/landing-sections";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { ScoreStack } from "@/components/marketing/score-stack";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Catch dirty money before it crosses the border",
  description:
    "Aegis scores every cross-border payment the moment it lands, shows exactly which signals fired, and carries the finding from alert to filed report.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: `${siteConfig.name} — Catch dirty money before it crosses`,
    description: siteConfig.description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}#organization`,
      name: siteConfig.name,
      legalName: siteConfig.legalName,
      url: siteConfig.url,
      email: siteConfig.contactEmail,
      description: siteConfig.description,
      sameAs: [siteConfig.socials.github, siteConfig.socials.linkedin, siteConfig.socials.x],
    },
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: siteConfig.url,
      description:
        "Transaction monitoring, alert triage and case management for cross-border payments, with explainable risk scoring.",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "392",
        highPrice: "1990",
        offerCount: "2",
      },
      publisher: { "@id": `${siteConfig.url}#organization` },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD is generated from local config, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        aria-labelledby="hero-heading"
        className="relative isolate overflow-hidden bg-[#05080F] text-[#EDF1F8]"
      >
        <HeroBackdrop />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-48 -top-24 size-[560px] rounded-full bg-[#F0B250]/[0.09] blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-1/4 size-[520px] rounded-full bg-[#2DD4BF]/[0.07] blur-[130px]"
        />

        <div className="container-page relative z-10 pb-10 pt-12 lg:pb-14 lg:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-6">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#F0B250]/85">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#F0B250] opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#F0B250]" />
                </span>
                Cross-border AML · scoring live
              </p>

              <h1
                id="hero-heading"
                className="display-hero mt-6 max-w-[13ch] text-[#F4F7FC]"
              >
                <span className="line">Most money moves clean.</span>
                <span className="line">You only see the rest</span>
                <span className="line">once it has <em>already crossed</em>.</span>
              </h1>

              <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.65] text-[#EDF1F8]/55 md:text-[16px]">
                Aegis scores every payment on arrival, then draws the shape behind the alert:
                the shell in the middle, the split under a threshold, the loop that closes, the
                corridor that is new. Analysts get the reasoning, not just a number.
              </p>

              <div className="mt-9 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button asChild size="lg" variant="accent" className="h-11 gap-2 px-5 text-[13.5px]">
                  <Link href="/signup">
                    Score your first payment
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-[11px] tracking-[0.01em] text-[#EDF1F8]/35">
                Free to explore. A scored reference dataset is already waiting inside.
              </p>

              <dl className="mt-10 grid max-w-[460px] grid-cols-3 gap-4 border-t border-white/10 pt-5">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-white/40">Median score</dt>
                  <dd className="num mt-1 text-[19px] font-semibold tracking-[-0.02em] text-white">&lt;200 ms</dd>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-white/40">Signals</dt>
                  <dd className="num mt-1 text-[19px] font-semibold tracking-[-0.02em] text-white">10 → 1</dd>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-white/40">Explained</dt>
                  <dd className="num mt-1 text-[19px] font-semibold tracking-[-0.02em] text-white">100%</dd>
                </div>
              </dl>
            </div>

            <div className="relative min-w-0">
              <RiskGlobe />
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/[0.07]">
          <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 text-[10.5px] text-white/35">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#2DD4BF]" aria-hidden="true" />
              Watching 5 reference corridors · 11,844 payments
            </span>
            <span className="hidden md:inline">Row-level security on every table</span>
            <span className="num">model v1.0 · 186 ms median</span>
          </div>
        </div>
      </section>

      <TrustStrip />
      <ProblemGrid />
      <HowItWorks />
      <ScoreStack />

      <section id="platform" aria-labelledby="showcase-heading" className="section-pad border-y border-border bg-card">
        <div className="container-page">
          <Reveal>
            <p className="section-kicker mb-4">
              The workspace
            </p>
            <h2 id="showcase-heading" className="display-section max-w-[24ch]">
              Signal to <em>filed decision</em>, on one screen.
            </h2>
            <p className="type-lede mt-4">
              Real screens from the reference dataset — volume, corridors, the alert queue, the
              network path behind a shell, and the clusters that add up to structuring.
            </p>
          </Reveal>
          <div className="mt-8">
            <ProductShowcase />
          </div>
        </div>
      </section>

      <FeatureGrid />
      <Testimonials />

      <section id="pricing" aria-labelledby="pricing-heading" className="section-pad scroll-mt-24">
        <div className="container-page">
          <Reveal>
            <p className="section-kicker mb-4">
              Pricing
            </p>
            <h2 id="pricing-heading" className="display-section max-w-[22ch]">
              Every plan runs all ten signals.
            </h2>
            <p className="type-lede mt-4">
              Nothing is held back at the scoring layer. What changes is how far a finding can
              travel: review notes on Starter, full case files at scale, regulatory packages and
              deployment controls at the top.{" "}
              <Link href="/pricing" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4">
                Compare the plans line by line
              </Link>
              .
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground">
              {[
                "Self-serve start, no integration",
                "Reference dataset included",
                "Cancel or change plan any time",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-risk-low" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="mt-8">
            <PricingSection compact />
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-heading" className="section-pad scroll-mt-24 border-t border-border bg-card">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="section-kicker mb-4">
              FAQ
            </p>
            <h2 id="faq-heading" className="display-section max-w-[18ch]">
              The questions compliance teams ask first.
            </h2>
            <p className="type-deck mt-4">
              Anything not covered here is best answered against your own data.{" "}
              <Link href="/contact?intent=demo" className="underline decoration-accent decoration-2 underline-offset-4">
                Book a working session
              </Link>
              .
            </p>
          </Reveal>
          <FaqSection />
        </div>
      </section>

      <FinalCta />
    </>
  );
}
