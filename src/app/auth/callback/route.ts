import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin } from "@/lib/public-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  // A fresh Google session lands where a dataset can be generated.
  if (!value) return "/app/library";
  // Only same-origin, relative paths are allowed; protocol-relative URLs are not.
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/library";
  if (value.includes("\\") || value.includes("://")) return "/app/library";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));
  const oauthError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description") ?? "";

  if (oauthError) {
    // Never echo the provider's raw text into the URL; map it to a known code so
    // the login page can show a useful sentence without reflecting untrusted input.
    const disabled = /not enabled|unsupported provider/i.test(errorDescription);
    const code = oauthError === "access_denied" ? "oauth_cancelled" : disabled ? "oauth_unavailable" : "oauth_failed";
    return NextResponse.redirect(new URL(`/login?error=${code}`, origin));
  }

  const supabase = await createServerSupabaseClient();

  // The destination survives a failed exchange so a reviewer who has to sign in
  // once still lands on the workspace they were confirming, not on the overview.
  const failure = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, origin));

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // A PKCE code is only redeemable in the browser that started the signup.
      // Links opened elsewhere (mail app, second device) land here; the login
      // page explains that instead of pretending the account is missing.
      return failure("callback_failed");
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "recovery" | "email" | "email_change" | "invite" | "magiclink",
    });
    if (error) {
      return failure("link_expired");
    }
  } else {
    return failure("missing_code");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id && next.startsWith("/app")) {
      return NextResponse.redirect(new URL("/onboarding", origin));
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
