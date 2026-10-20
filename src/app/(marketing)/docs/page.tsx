import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import { docs } from "@/content/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Quickstart, API reference, webhooks and a compliance glossary for Aegis.",
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  return (
    <div className="container-page section-pad">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-muted-foreground">
          Documentation
        </p>
        <h1 className="mt-3 text-display-lg">Build against the same model the analysts use.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Four guides cover the path from an empty account to a scored, investigated and reported
          payment. Everything documented here is exercised by the seeded demo dataset.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="card-positivus group flex h-full flex-col"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">{doc.title}</h2>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                {doc.readingMinutes} min
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{doc.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Read the guide
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
