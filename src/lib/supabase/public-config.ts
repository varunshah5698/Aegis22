/**
 * Public Supabase connection settings.
 *
 * Next.js replaces statically-referenced NEXT_PUBLIC_* variables at build time.
 * Hosts such as Render inject variables at runtime instead, so server code must
 * read them dynamically (bracket access) to avoid a bundle that was built
 * without them. The bundled values below match the project's public settings;
 * every deployment can override them with environment variables. The anon key
 * is a publishable client credential — row-level security enforces access.
 */

const FALLBACK_URL = "https://wextsivilupiimgmleug.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_8tSbCW8EQzEBd1cdzc45og_HCt9AOyJ";

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
  configured: boolean;
};

/** Server-side read that works whether the host injects env at build or runtime. */
export function readServerSupabaseConfig(): SupabasePublicConfig {
  const url =
    process.env.SUPABASE_URL || process.env["NEXT_PUBLIC_SUPABASE_URL"] || FALLBACK_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    FALLBACK_ANON_KEY;

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

export const SUPABASE_URL_META = "aegis-supabase-url";
export const SUPABASE_ANON_KEY_META = "aegis-supabase-anon-key";
