"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

type Availability = "checking" | "ready" | "disabled" | "unknown";

/**
 * Google OAuth entry point.
 *
 * The Supabase project decides whether the provider exists, so the button asks
 * the server before redirecting. When Google is not enabled the user gets a
 * readable inline message instead of a raw "provider is not enabled" page.
 */
export function GoogleButton({ label, next = "/app/library" }: { label: string; next?: string }) {
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [availability, setAvailability] = React.useState<Availability>("checking");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/auth/providers", {
          headers: { accept: "application/json" },
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as { data: { google: boolean } | null };
        if (cancelled) return;
        if (!response.ok || !payload.data) {
          setAvailability("unknown");
          return;
        }
        setAvailability(payload.data.google ? "ready" : "disabled");
      } catch {
        if (!cancelled && !controller.signal.aborted) setAvailability("unknown");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const onClick = async () => {
    if (availability !== "ready") return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) {
        setError("Google sign-in is not available right now. Use email and password, or try again shortly.");
      }
    } catch {
      setError("Google sign-in could not start. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={onClick}
        disabled={loading || availability !== "ready"}
        aria-describedby={availability === "disabled" || availability === "unknown" ? "google-status" : undefined}
      >
        <GoogleGlyph />
        {loading ? "Opening Google…" : label}
      </Button>
      {availability === "disabled" ? (
        <p id="google-status" className="text-xs text-muted-foreground">
          Google sign-in is not enabled for this Supabase project. An administrator can enable the provider under
          Authentication → Providers. Email and password works now.
        </p>
      ) : null}
      {availability === "unknown" ? (
        <p id="google-status" className="text-xs text-muted-foreground">
          Google sign-in could not be checked. Use email and password, or reload to try again.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-risk-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
