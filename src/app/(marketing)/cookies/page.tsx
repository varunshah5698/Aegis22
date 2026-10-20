import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Cookies",
  description: "The cookies and local storage Aegis uses, and why.",
  alternates: { canonical: "/cookies" },
};

const rows = [
  {
    name: "sb-*-auth-token",
    type: "Strictly necessary",
    purpose: "Stores the Supabase session so you stay signed in across requests.",
    duration: "Session or 30 days with “remember this device”",
  },
  {
    name: "aegis-theme",
    type: "Preference (local storage, not a cookie)",
    purpose: "Remembers light, dark or system theme. Never sent to the server.",
    duration: "Until cleared",
  },
  {
    name: "sidebar-collapsed",
    type: "Preference",
    purpose: "Remembers whether the dashboard sidebar is collapsed.",
    duration: "1 year",
  },
  {
    name: "_ga / _ga_*",
    type: "Analytics (optional)",
    purpose: "Loaded only when NEXT_PUBLIC_GA_ID is configured and you accept analytics.",
    duration: "13 months",
  },
];

export default function CookiesPage() {
  return (
    <div className="container-page section-pad">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-display-lg">Cookie notice</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated 18 October 2026</p>

        <div className="prose-sf mt-8">
          <p>
            We keep browser storage to the minimum needed to run the application. Strictly necessary
            storage cannot be turned off; without it you cannot stay signed in. Analytics are disabled
            unless a measurement id is configured for the deployment.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-hero border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Cookies and local storage used by Aegis</caption>
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Name</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Type</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Purpose</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <th scope="row" className="px-4 py-3 text-left font-mono text-xs font-normal">
                    {row.name}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{row.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.purpose}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prose-sf mt-8">
          <p>
            You can clear cookies and local storage in your browser at any time; you will be signed
            out. Questions about this notice:{" "}
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
