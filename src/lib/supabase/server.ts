import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";
import { readServerSupabaseConfig } from "@/lib/supabase/public-config";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = readServerSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured for this deployment");
  }

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. Middleware refreshes the session.
          }
        },
      },
    },
  );
}
