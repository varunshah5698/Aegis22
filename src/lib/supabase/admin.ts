import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Privileged client. Only use for operations that cannot be expressed with the
 * signed-in user's session (for example, scheduled digests across tenants).
 * Returns null when no service role key is configured; callers must degrade
 * gracefully instead of assuming elevated access.
 */
export function createAdminSupabaseClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
