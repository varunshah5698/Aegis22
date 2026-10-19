import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that govern use of the Aegis application and website.",
  alternates: { canonical: "/terms" },
};

const updated = "18 October 2026";

export default function TermsPage() {
  return (
    <div className="container-page section-pad">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-display-lg">Terms of service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>

        <div className="prose-sf mt-8">
          <p>
            These terms govern access to the Aegis website and application provided by{" "}
            {siteConfig.legalName}. By creating an account or using the service you agree to them. If
            you are accepting on behalf of an organization, you confirm you have authority to do so.
          </p>

          <h2>1. The service</h2>
          <p>
            Aegis scores payment transactions for financial-crime risk, explains the scoring,
            and supports alert triage, case management and report generation. The service is a
            decision-support tool. It does not provide legal advice and does not replace your
            regulatory obligations, including suspicious activity reporting.
          </p>

          <h2>2. Accounts and access</h2>
          <p>
            You must provide accurate account information, keep credentials confidential, and tell us
            promptly about unauthorised access. Seats are per named user; credentials must not be
            shared. Administrators control roles and can require multi-factor authentication.
          </p>

          <h2>3. Customer data</h2>
          <p>
            Your organization retains ownership of the data it submits. You grant us a limited licence
            to process it to provide the service. You are responsible for having a lawful basis to
            submit that data and for the accuracy of what you send. We process it as described in the
            privacy policy and our data processing agreement.
          </p>

          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not attempt to access another organization's data or probe the service for vulnerabilities outside the disclosure policy.</li>
            <li>Do not submit data you have no right to process, or use the service to facilitate unlawful activity.</li>
            <li>Do not resell, sublicense or benchmark the service for a competing product.</li>
          </ul>

          <h2>5. Availability and support</h2>
          <p>
            Hosted plans target 99.9% monthly availability, measured excluding scheduled maintenance
            announced in advance. Enterprise agreements may carry a different commitment and service
            credits. Support responds during business hours unless a priority plan states otherwise.
          </p>

          <h2>6. Fees</h2>
          <p>
            Fees are stated per plan and exclude tax. Annual plans are invoiced in advance; monthly
            plans renew until cancelled before the next cycle. Overdue invoices may lead to suspension
            after notice.
          </p>

          <h2>7. Intellectual property</h2>
          <p>
            We own the service, the scoring model and its documentation. You own your data and any
            rules you author. Feedback may be used to improve the product without obligation.
          </p>

          <h2>8. Liability</h2>
          <p>
            To the extent permitted by law, neither party is liable for indirect or consequential loss.
            Our aggregate liability is limited to the fees paid in the twelve months before the claim.
            Nothing limits liability for fraud, wilful misconduct or death and personal injury.
          </p>

          <h2>9. Termination</h2>
          <p>
            You may cancel at any time. We may suspend access for material breach, non-payment or a
            security risk. On termination, you can export your data for 30 days, after which it is
            deleted according to the retention schedule.
          </p>

          <h2>10. Governing law</h2>
          <p>
            These terms are governed by the laws of England and Wales, and the courts of London have
            exclusive jurisdiction. Questions:{" "}
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
