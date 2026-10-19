import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { fail, ok, validationError } from "@/lib/api/response";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas/auth";
import type { Database } from "@/lib/supabase/database.types";
import { readServerSupabaseConfig } from "@/lib/supabase/public-config";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

/**
 * Sign-in runs on the server so failed attempts can be rate limited per email
 * and IP. "Remember this device" decides whether the Supabase auth cookies are
 * persistent or session-scoped.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", "Send a JSON body.", { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { email, password, remember } = parsed.data;
  const ipLimit = rateLimit({ key: clientKey(request, "login"), limit: 20, windowMs: WINDOW_MS });
  const emailLimit = rateLimit({ key: `login:email:${email}`, limit: MAX_ATTEMPTS, windowMs: WINDOW_MS });
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    return fail(
      "rate_limited",
      `Too many sign-in attempts. Try again in ${Math.ceil(retry / 60)} minutes.`,
      { status: 429, headers: { ...rateLimitHeaders(emailLimit), "Retry-After": String(retry) } },
    );
  }

  const response = NextResponse.next();
  const { url, anonKey } = readServerSupabaseConfig();

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (remember) {
              response.cookies.set(name, value, options);
              return;
            }
            // Session cookie: no maxAge or expires, so it ends with the browser session.
            const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
            response.cookies.set(name, value, sessionOptions);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message to avoid account enumeration.
    return fail("invalid_credentials", "Email or password is incorrect.", {
      status: 401,
      meta: { remaining: emailLimit.remaining },
    });
  }

  const success = ok({ signedIn: true }, { headers: rateLimitHeaders(emailLimit) });
  // Copy the Supabase auth cookies with their original attributes (maxAge/expiry).
  response.headers.getSetCookie().forEach((cookie) => success.headers.append("set-cookie", cookie));
  return success;
}
