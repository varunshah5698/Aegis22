import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Timer } from "lucide-react";

import { DemoVideoDialog } from "@/components/marketing/demo-video-dialog";
import { FaqSection } from "@/components/marketing/faq-section";
import { HeroPreview } from "@/components/marketing/hero-preview";
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
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Real-time AML monitoring for cross-border payments",
  description:
    "Score every cross-border payment in real time, see exactly which signals fired, and move flagged activity through investigation to regulatory reporting.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: `${siteConfig.name} — Catch illicit cross-border flows before they settle`,
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

      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div className="paper-grid absolute inset-0" aria-hidden="true" />
        <div className="lime-glow absolute inset-0" aria-hidden="true" />
        <div className="container-page relative pb-16 pt-12 lg:pb-24 lg:pt-16">
          <p className="inline-flex items-center gap-2 rounded-pill border border-foreground/20 bg-card px-3 py-1.5 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Real-time AML monitoring for cross-border payments
          </p>
          <h1
            id="hero-heading"
            className="mt-5 max-w-[1040px] text-[clamp(2.5rem,4.6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]"
          >
            Catch illicit cross-border flows before they settle.
          </h1>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div className="min-w-0">
            <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Aegis scores every payment in real time, detects pass-through intermediaries,
              splitting and circular flows, and shows your analysts the exact evidence behind each
              decision.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href="/signup">
                  Start free trial
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <DemoVideoDialog />
            </div>

            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Timer className="size-4" aria-hidden="true" />
                <dt className="sr-only">Latency</dt>
                <dd>Median score in under 200 ms</dd>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" />
                <dt className="sr-only">Data isolation</dt>
                <dd>Organization-scoped row-level security</dd>
              </div>
            </dl>
          </div>

          <div className="relative min-w-0">
            <div className="absolute -inset-4 rounded-[28px] bg-accent/20 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <HeroPreview />
            </div>
          </div>
          </div>
        </div>
      </section>

      <TrustStrip />
      <ProblemGrid />
      <HowItWorks />

      <section id="platform" aria-labelledby="showcase-heading" className="section-pad border-y-2 border-foreground/10 bg-card">
        <div className="container-page">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              The workspace
            </p>
            <h2 id="showcase-heading" className="max-w-3xl text-display-lg">
              One screen from signal to decision.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              The same views your analysts use in production, rendered from the reference dataset:
              volume, corridors, alerts, network paths and structuring clusters.
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Pricing
            </p>
            <h2 id="pricing-heading" className="max-w-3xl text-display-lg">
              Priced per programme, not per alert.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Every plan includes all ten signals. Higher tiers add investigation depth, reporting
              and deployment controls.{" "}
              <Link href="/pricing" className="font-medium underline decoration-accent decoration-2 underline-offset-4">
                Compare plans in detail
              </Link>
              .
            </p>
          </Reveal>
          <div className="mt-8">
            <PricingSection compact />
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-heading" className="section-pad scroll-mt-24 border-t-2 border-foreground/10 bg-card">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              FAQ
            </p>
            <h2 id="faq-heading" className="text-display-md">
              Questions compliance teams ask first.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Anything not covered here is best answered with your own data.{" "}
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
