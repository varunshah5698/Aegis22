import { createBrowserClient } from "@supabase/ssr";

import {
  SUPABASE_ANON_KEY_META,
  SUPABASE_URL_META,
} from "@/lib/supabase/public-config";
import type { Database } from "@/lib/supabase/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

function readMeta(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
  return value?.trim() || undefined;
}

/**
 * Resolve the public Supabase settings at runtime.
 *
 * The root layout renders them into meta tags, so a deployment that injects
 * environment variables only at runtime (Render, for example) still works even
 * though Next.js inlined an empty NEXT_PUBLIC_* value at build.
 */
export function getPublicSupabaseConfig() {
  const url = readMeta(SUPABASE_URL_META) ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = readMeta(SUPABASE_ANON_KEY_META) ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public environment variables are missing");
  }

  return { url, key };
}

export function createClient() {
  if (client) return client;

  const { url, key } = getPublicSupabaseConfig();
  client = createBrowserClient<Database>(url, key);
  return client;
}
