import type { Metadata } from "next";
import Link from "next/link";
import { Database, FileCheck2, KeyRound, Lock, ScrollText, ServerCog, UserCheck } from "lucide-react";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Aegis isolates tenant data, controls access, records sensitive actions and handles vulnerability reports.",
  alternates: { canonical: "/security" },
};

const controls = [
  {
    icon: Database,
    title: "Tenant isolation in the database",
    body: "Every table has row-level security enabled. Policies resolve the caller's organization from their profile and reject any row outside it, so an application bug cannot widen a query across tenants. Organization ids are never accepted from the client.",
  },
  {
    icon: KeyRound,
    title: "Credentials that stay server-side",
    body: "The service-role key is marked server-only and never enters a client bundle. The browser uses the publishable anon key with the signed-in user's session, so the same policies apply to every request.",
  },
  {
    icon: UserCheck,
    title: "Role-based access with MFA",
    body: "Admins manage the team, rules and keys. Analysts triage alerts and cases. Viewers read dashboards, alerts and reports. Administrators can require TOTP MFA for everyone in the organization, and the server enforces it on protected routes.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    body: "Sensitive mutations write to an audit log that cannot be updated or deleted through the API. Alert events are append-only too, so an investigation timeline cannot be rewritten after the fact.",
  },
  {
    icon: Lock,
    title: "Encryption and transport",
    body: "Traffic is served over TLS 1.2+ with HSTS. Managed Postgres encrypts data at rest, and report files live in a private storage bucket reachable only through short-lived signed URLs scoped to the organization.",
  },
  {
    icon: ServerCog,
    title: "Rate limits and idempotency",
    body: "Every API route has a sliding-window limit with RateLimit headers and Retry-After. Ingest is idempotent on your external id, and scoring requests can carry an Idempotency-Key so a retry cannot double-book a payment.",
  },
  {
    icon: FileCheck2,
    title: "Secure headers",
    body: "The middleware sets a nonce-based Content-Security-Policy, frame denial, a strict referrer policy and a permissions policy that disables camera, microphone and geolocation by default.",
  },
  {
    icon: ServerCog,
    title: "Data residency",
    body: "Hosted deployments run in a single region chosen at provisioning. Enterprise plans can be pinned to a dedicated environment. The reference project in this repository is a shared demo and should not hold production data.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="border-b-2 border-foreground/10">
        <div className="container-page py-14 md:py-20">
          <p className="text-xs font-semibold text-muted-foreground">
            Security
          </p>
          <h1 className="mt-3 max-w-4xl text-display-xl">
            Compliance software has to survive its own audit.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            This page describes what the reference build actually does. It is written to be checked
            against the code: policies live in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">supabase/migrations</code>, rate limits and
            validation in <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">src/app/api</code>.
          </p>
        </div>
      </section>

      <section className="container-page section-pad">
        <div className="grid gap-5 md:grid-cols-2">
          {controls.map((control) => {
            const Icon = control.icon;
            return (
              <article key={control.title} className="card-positivus">
                <div className="flex size-10 items-center justify-center rounded-card bg-foreground text-background">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold tracking-tight">{control.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{control.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y-2 border-foreground/10 bg-card">
        <div className="container-page section-pad grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-display-md">Standards alignment</h2>
            <div className="prose-sf mt-4">
              <p>
                The monitoring workflow is designed to align with the FATF risk-based approach:
                alerts carry a stated reason, investigations keep evidence attached, and decisions
                record who made them and when.
              </p>
              <p>
                Data handling is designed around GDPR principles — a lawful basis per purpose,
                data minimisation, retention limits and deletion on request. This reference build
                does not claim SOC 2, ISO 27001 or PCI DSS certification. Any certification claim
                must come from an audit of the deployed environment and be confirmed in your
                contract.
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-display-md">Reporting a vulnerability</h2>
            <div className="prose-sf mt-4">
              <p>
                Email{" "}
                <a href={`mailto:security@${siteConfig.url.replace(/^https?:\/\//, "").replace(/:\d+$/, "")}`}>
                  security@aegis.example
                </a>{" "}
                with the affected route, reproduction steps and impact. Do not test against another
                customer's data, and do not run denial-of-service tests.
              </p>
              <p>
                We acknowledge within two business days, confirm a remediation window once the issue
                is reproduced, and credit reporters who ask to be named. There is no bounty
                programme for this reference build.
              </p>
            </div>
            <div className="mt-6 rounded-card border border-border bg-background p-4 text-sm">
              <p className="font-medium">Subprocessors in the reference deployment</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Supabase — Postgres, authentication, storage, realtime</li>
                <li>Vercel — application hosting and edge middleware</li>
                <li>Resend — transactional email, only when configured</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Review the current list and regions before signing a data processing agreement. See
                also <Link href="/privacy" className="underline decoration-accent decoration-2 underline-offset-4">Privacy</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
