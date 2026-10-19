import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4", className)}>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="rounded hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
