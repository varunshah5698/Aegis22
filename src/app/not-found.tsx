import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="container-page flex h-20 items-center">
        <Logo />
      </div>
      <main id="main-content" className="container-page flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="num mt-6 text-xs text-muted-foreground">Error 404</p>
        <h1 className="mt-3 max-w-xl text-display-md">This page is not on the corridor.</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          The link may be out of date, or the record you followed was removed. Start from the
          overview or search the documentation.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="accent">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Back to the homepage
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/docs">Read the documentation</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
