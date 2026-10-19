import { NextResponse } from "next/server";

import { getAiConfig } from "@/lib/ai/river";
import { getFxProviderConfig } from "@/lib/fx/provider";
import { readServerSupabaseConfig } from "@/lib/supabase/public-config";

export const dynamic = "force-dynamic";

/**
 * Rollout probe for Render (and any other host).
 *
 * It must answer 2xx without touching Supabase or any other dependency, so a
 * slow database never blocks a deploy. It also reports which optional
 * integrations have credentials, as booleans only: that is enough to tell
 * "Render is missing a key" apart from "the key is present but rejected",
 * without leaking a single character of any secret.
 */
export function GET() {
  const supabase = readServerSupabaseConfig();
  const ai = getAiConfig();
  const fx = getFxProviderConfig();

  return NextResponse.json(
    {
      status: "ok",
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      integrations: {
        // Public values with bundled fallbacks, so this is true unless a host
        // injects empty strings.
        supabase: supabase.configured,
        // Server-only: RIVER_API_KEY.
        ai: ai.configured,
        // Frankfurter needs no key; any other provider does.
        fx: { provider: fx.id, ready: !fx.requiresKey || fx.hasKey },
        email: Boolean(process.env.RESEND_API_KEY),
        rateLimit: Boolean(process.env.RATE_LIMIT_REDIS_URL),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
