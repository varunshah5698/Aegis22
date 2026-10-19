import "server-only";
import { z } from "zod";

import { readServerSupabaseConfig } from "@/lib/supabase/public-config";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_JWT_SECRET: optionalString,
  SUPABASE_STORAGE_BUCKET_REPORTS: z.string().min(1).default("reports"),
  RATE_LIMIT_REDIS_URL: optionalString,
  RESEND_API_KEY: optionalString,
  NEXT_PUBLIC_GA_ID: optionalString,
  SCORING_MODEL_VERSION: z.string().min(1).default("v1"),
});

export type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  const parsed = envSchema.safeParse({
    // Render exposes the service URL at build and runtime; use it when an
    // explicit canonical URL has not been configured.
    NEXT_PUBLIC_SITE_URL:
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:3100",
    NEXT_PUBLIC_SUPABASE_URL: readServerSupabaseConfig().url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: readServerSupabaseConfig().anonKey,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    SUPABASE_STORAGE_BUCKET_REPORTS: process.env.SUPABASE_STORAGE_BUCKET_REPORTS,
    RATE_LIMIT_REDIS_URL: process.env.RATE_LIMIT_REDIS_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    SCORING_MODEL_VERSION: process.env.SCORING_MODEL_VERSION,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Set these variables in the deployment environment.\n${issues}`,
    );
  }

  return parsed.data;
}

let cached: Env | undefined;

/**
 * Validation is deferred until a request actually needs configuration.
 *
 * Next.js imports every route while collecting page data, so validating at
 * module load made a production build fail on hosts that inject secrets only
 * at runtime. The server still refuses to serve with incomplete configuration,
 * but the build itself no longer depends on production secrets.
 */
export function getEnv(): Env {
  cached ??= readEnv();
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, property) {
    return getEnv()[property as keyof Env];
  },
  has(_target, property) {
    return property in getEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor(_target, property) {
    return {
      enumerable: true,
      configurable: true,
      value: getEnv()[property as keyof Env],
    };
  },
});
