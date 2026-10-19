import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Aegis collects, why, how long it is kept and how to exercise your rights.",
  alternates: { canonical: "/privacy" },
};

const updated = "18 October 2026";

export default function PrivacyPage() {
  return (
    <div className="container-page section-pad">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-display-lg">Privacy policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>

        <div className="prose-sf mt-8">
          <p>
            {siteConfig.legalName} (“Aegis”, “we”) provides transaction monitoring software to
            financial institutions. This policy explains what we collect when you use the website and
            the application, and what our customers remain responsible for.
          </p>

          <h2>Two different roles</h2>
          <p>
            For account data — your name, email, organization membership and billing details — we act
            as a controller. For the payment and customer data your organization sends to the
            application, your organization is the controller and we act as a processor under its
            instructions. We do not use customer payment data to train models for other customers.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>Account details: name, work email, organization, role, timezone, avatar.</li>
            <li>Authentication events: sign-in time, IP address, session and MFA status.</li>
            <li>
              Product usage needed to operate the service: pages requested, API calls, latency,
              error codes. We do not record the contents of payment messages in application logs.
            </li>
            <li>Messages you send us through the contact form or by email.</li>
            <li>Newsletter email address, if you subscribe. Unsubscribing removes you from the list.</li>
          </ul>

          <h2>Why we process it</h2>
          <p>
            To provide and secure the service, to investigate abuse, to meet legal and accounting
            obligations, and — only with consent — to send the monthly compliance brief. We do not
            sell personal data and we do not share it with advertising networks.
          </p>

          <h2>Retention</h2>
          <p>
            Account records are kept while the organization is active and for as long as tax and
            company law requires afterwards. Audit records are retained for the period configured in
            the organization's policy. Customer payment data follows the retention setting agreed in
            the contract; the demo dataset in this repository is synthetic.
          </p>

          <h2>Your rights</h2>
          <p>
            You can request access, correction, export, restriction or deletion of your personal data,
            and object to processing based on legitimate interests. Email{" "}
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. We respond
            within 30 days. Where we process data on behalf of your organization, we will forward the
            request to it.
          </p>

          <h2>International transfers</h2>
          <p>
            Hosted deployments run in a single region selected at provisioning. Where support staff
            access data from another country, transfers rely on standard contractual clauses and
            access is logged.
          </p>

          <h2>Cookies</h2>
          <p>
            The application uses strictly necessary cookies for session management and a local storage
            entry for your theme preference. Analytics are off unless a measurement id is configured.
            See the <a href="/cookies">cookie notice</a>.
          </p>

          <h2>Contact</h2>
          <p>
            Data protection enquiries: {siteConfig.legalName}, 14 Finsbury Square, London EC2A 1AH, or{" "}
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. If you are in
            the EU, you may also complain to your supervisory authority.
          </p>
        </div>
      </div>
    </div>
  );
}
