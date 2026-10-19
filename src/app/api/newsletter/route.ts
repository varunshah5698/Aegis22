import { fail, ok, validationError } from "@/lib/api/response";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { newsletterSchema } from "@/lib/schemas/contact";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = rateLimit({ key: clientKey(request, "newsletter"), limit: 8, windowMs: 10 * 60_000 });
  if (!limit.allowed) {
    return fail("rate_limited", "Too many signups from this address. Try again shortly.", {
      status: 429,
      headers: rateLimitHeaders(limit),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", "Send a JSON body.", { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.website) return ok({ subscribed: true }, { headers: rateLimitHeaders(limit) });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data.email, source: "footer" }, { onConflict: "email" });

  if (error) {
    return fail("storage_error", "Subscription failed. Please try again.", {
      status: 500,
      headers: rateLimitHeaders(limit),
    });
  }

  return ok({ subscribed: true }, { status: 201, headers: rateLimitHeaders(limit) });
}
