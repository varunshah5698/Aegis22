import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public environment variables are missing");
  }

  client = createBrowserClient<Database>(url, key);
  return client;
}
