import type { Metadata } from "next";
import { Mail, MapPin, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/marketing/contact-form";
import { contactRequestSchema } from "@/lib/schemas/contact";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Aegis team about monitoring your cross-border payment corridors.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const params = await searchParams;
  const parsedIntent = contactRequestSchema.shape.intent.safeParse(params.intent);
  const defaultIntent = parsedIntent.success ? parsedIntent.data : "demo";

  return (
    <div className="container-page section-pad">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Contact
          </p>
          <h1 className="mt-3 text-display-lg">Bring a corridor. We will walk it through.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
            Demos use your own payment patterns where possible. Tell us the corridors, volumes and
            current tooling, and we will show the alert and case flow against realistic data.
          </p>

          <dl className="mt-8 space-y-5 text-sm">
            <div className="flex gap-3">
              <Mail className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="font-medium">Email</dt>
                <dd>
                  <a className="underline decoration-accent decoration-2 underline-offset-4" href={`mailto:${siteConfig.contactEmail}`}>
                    {siteConfig.contactEmail}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="font-medium">Registered office</dt>
                <dd className="text-muted-foreground">{siteConfig.legalName}, 14 Finsbury Square, London EC2A 1AH</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="font-medium">Security reports</dt>
                <dd className="text-muted-foreground">
                  Email <a className="underline decoration-accent decoration-2 underline-offset-4" href={`mailto:security@${siteConfig.url.replace(/^https?:\/\//, "").replace(/:\d+$/, "")}`}>security@aegis.example</a> with steps to reproduce. We acknowledge within two business days.
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-hero border-2 border-foreground/15 bg-card p-6 shadow-card md:p-8">
          <ContactForm defaultIntent={defaultIntent} />
        </div>
      </div>
    </div>
  );
}
