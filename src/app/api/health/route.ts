import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Rollout probe for Specific. It must answer 2xx without touching Supabase or
 * any other dependency, so a slow database never blocks a deploy.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
