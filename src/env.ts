import "server-only";
import { z } from "zod";

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

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
      `Invalid environment configuration. Copy .env.example to .env.local and fill in the required values.\n${issues}`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
