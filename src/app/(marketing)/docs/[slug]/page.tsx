import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, TriangleAlert } from "lucide-react";

import { docs, getDoc, type DocBlock } from "@/content/docs";
import { docsNav } from "@/config/site";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: "Documentation" };
  return {
    title: `${doc.title} — Documentation`,
    description: doc.description,
    alternates: { canonical: `/docs/${doc.slug}` },
  };
}

function Block({ block }: { block: DocBlock }) {
  return (
    <section className="scroll-mt-24" id={block.heading?.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
      {block.heading ? <h2 className="mt-10 text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
      {block.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {block.bullets ? (
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-7 text-muted-foreground">
          {block.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {block.code ? (
        <figure className="mt-4 overflow-hidden rounded-card border border-border bg-[#101218]">
          <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[12px] text-white/60">
            <span>{block.code.label}</span>
            <span className="font-mono lowercase">{block.code.language}</span>
          </figcaption>
          <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-[#E8E8E1]">
            <code>{block.code.value}</code>
          </pre>
        </figure>
      ) : null}
      {block.callout ? (
        <aside
          className={cn(
            "mt-5 flex gap-3 rounded-card border p-4 text-sm",
            block.callout.tone === "warning"
              ? "border-risk-medium/40 bg-risk-medium/10"
              : "border-border bg-muted/60",
          )}
        >
          {block.callout.tone === "warning" ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-risk-medium" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div>
            <p className="font-medium">{block.callout.title}</p>
            <p className="mt-1 text-muted-foreground">{block.callout.body}</p>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const index = docs.findIndex((item) => item.slug === doc.slug);
  const previous = index > 0 ? docs[index - 1] : undefined;
  const next = index < docs.length - 1 ? docs[index + 1] : undefined;

  return (
    <div className="container-page py-12 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[220px_1fr_200px]">
        <nav aria-label="Documentation" className="hidden lg:block">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            Guides
          </p>
          <ul className="space-y-1">
            {docsNav.map((item) => {
              const active = item.href === `/docs/${doc.slug}`;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <article>
          <p className="text-xs font-semibold text-muted-foreground">
            Documentation
          </p>
          <h1 className="mt-2 text-display-md">{doc.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{doc.description}</p>

          <div className="mt-6 divide-y divide-border">
            {doc.blocks.map((block, blockIndex) => (
              <Block key={block.heading ?? blockIndex} block={block} />
            ))}
          </div>

          <nav aria-label="Guide pagination" className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            {previous ? (
              <Link href={`/docs/${previous.slug}`} className="inline-flex items-center gap-2 text-sm font-medium">
                <ArrowLeft className="size-4" aria-hidden="true" />
                {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`} className="inline-flex items-center gap-2 text-sm font-medium">
                {next.title}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        </article>

        <aside className="hidden lg:block">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            On this page
          </p>
          <ul className="space-y-2 text-xs">
            {doc.blocks
              .filter((block) => block.heading)
              .map((block) => (
                <li key={block.heading}>
                  <a
                    href={`#${block.heading!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {block.heading}
                  </a>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
