import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
