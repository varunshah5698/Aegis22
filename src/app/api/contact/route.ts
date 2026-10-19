import { fail, ok, validationError } from "@/lib/api/response";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { contactRequestSchema } from "@/lib/schemas/contact";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = rateLimit({ key: clientKey(request, "contact"), limit: 5, windowMs: 10 * 60_000 });
  if (!limit.allowed) {
    return fail("rate_limited", "Too many messages from this address. Try again shortly.", {
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

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  // Honeypot: answer exactly like success so bots learn nothing.
  if (input.website) return ok({ received: true }, { headers: rateLimitHeaders(limit) });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("contact_requests").insert({
    name: input.name,
    email: input.email,
    company: input.company ?? "",
    message: input.message,
    intent: input.intent,
    source: "marketing",
  });

  if (error) {
    return fail("storage_error", "We could not store your message. Please email us instead.", {
      status: 500,
      headers: rateLimitHeaders(limit),
    });
  }

  return ok({ received: true }, { status: 201, headers: rateLimitHeaders(limit) });
}
