import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";

const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

function securityHeaders(isDev: boolean, nonce?: string): Record<string, string> {
  // Marketing pages stay statically rendered (no per-request nonce) and rely on a
  // stricter self-only policy plus a build-time-safe inline allowance. Authenticated
  // areas are dynamic anyway and use a nonce with strict-dynamic.
  const scriptPolicy = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`
    : `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`;

  const csp = [
    "default-src 'self'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in${isDev ? " ws: http://localhost:*" : ""}`,
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };

  if (!isDev) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

function applyHeaders<T extends NextResponse>(response: T, headers: Record<string, string>): T {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const { pathname } = request.nextUrl;

  // API handlers validate their own credentials and return JSON envelopes.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const dynamicArea =
    pathname.startsWith("/app") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/");

  const nonce = dynamicArea ? btoa(crypto.randomUUID()) : undefined;
  const headers = securityHeaders(isDev, nonce);

  if (nonce) {
    request.headers.set("x-nonce", nonce);
    request.headers.set("Content-Security-Policy", headers["Content-Security-Policy"] ?? "");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApp = pathname.startsWith("/app");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isAuthEntry = AUTH_ENTRY_PATHS.has(pathname);

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return applyHeaders(redirect, headers);
  };

  if (!user && (isApp || isOnboarding)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (user && isAuthEntry) {
    return redirectTo("/app/overview");
  }

  // An unverified address cannot open the workspace or complete onboarding.
  if (user && (isApp || isOnboarding) && !user.email_confirmed_at) {
    return redirectTo("/verify-email");
  }

  if (user && (isApp || isOnboarding)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id && !isOnboarding) {
      return redirectTo("/onboarding");
    }
    if (profile?.organization_id && isOnboarding) {
      return redirectTo("/app/overview");
    }
  }

  return applyHeaders(response, headers);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
