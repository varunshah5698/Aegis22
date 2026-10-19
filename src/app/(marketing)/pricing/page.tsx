import type { Metadata } from "next";
import Link from "next/link";

import { FaqSection } from "@/components/marketing/faq-section";
import { PricingSection } from "@/components/marketing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Starter, Growth and Enterprise plans for cross-border transaction monitoring. All plans include every risk signal.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <section className="border-b-2 border-foreground/10">
        <div className="container-page py-14 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="mt-3 max-w-3xl text-display-xl">Priced per programme, not per alert.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Every plan includes the full signal set, explainable scores and the alert queue. You pay
            for volume, investigation depth and deployment control — not for the number of times the
            model is right.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Need a pilot with your own data?{" "}
            <Link href="/contact?intent=demo" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4">
              Book a working session
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="container-page section-pad">
        <PricingSection />
      </section>

      <section className="border-t-2 border-foreground/10 bg-card">
        <div className="container-page section-pad grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-display-md">Billing and procurement</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Annual plans are invoiced up front and can start on a purchase order. Monthly plans
              renew automatically and can be cancelled before the next cycle.
            </p>
          </div>
          <FaqSection />
        </div>
      </section>
    </>
  );
}
