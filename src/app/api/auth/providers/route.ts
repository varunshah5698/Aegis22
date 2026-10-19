import { NextResponse } from "next/server";

import { readServerSupabaseConfig } from "@/lib/supabase/public-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public provider discovery.
 *
 * Supabase's settings endpoint reports which external providers are enabled.
 * The sign-in button checks this first so a disabled provider fails inline
 * instead of sending the browser to a raw JSON error page. Only booleans are
 * returned; no client IDs, secrets or project keys leave the server.
 */
export async function GET() {
  const { url, anonKey: key } = readServerSupabaseConfig();

  if (!url || !key) {
    return NextResponse.json(
      { data: null, error: { code: "not_configured", message: "Supabase is not configured for this deployment." } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { data: null, error: { code: "unavailable", message: "The auth provider list could not be read." } },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }

    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return NextResponse.json(
      {
        data: {
          google: settings.external?.google === true,
          email: settings.external?.email === true,
        },
        error: null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "unavailable", message: "The auth provider list could not be read." } },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
