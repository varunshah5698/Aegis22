"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface the digest in the console so support can correlate it with server logs.
    console.error("Unhandled application error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="container-page flex h-20 items-center">
        <Logo />
      </div>
      <main id="main-content" className="container-page flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-risk-critical/10">
          <TriangleAlert className="size-6 text-risk-critical" aria-hidden="true" />
        </span>
        <p className="num mt-6 text-xs text-muted-foreground">Unexpected error</p>
        <h1 className="mt-3 max-w-xl text-display-md">The page failed before it could finish.</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Nothing was changed. Retry the request; if it keeps failing, send the reference below to
          support so we can trace it.
        </p>
        {error.digest ? (
          <p className="num mt-4 rounded-pill bg-muted px-3 py-1 text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button variant="accent" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to the homepage</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
