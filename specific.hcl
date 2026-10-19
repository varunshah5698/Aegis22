# SentinelFlow runs as a single Next.js service. `pnpm-lock.yaml` is detected
# automatically, so the build command only has to compile the app.

# Public Supabase URL and publishable key. Both are read from the environment
# (src/env.ts) and the key is safe to expose to the browser; RLS enforces access.
# Set them with `specific deploy --config supabase_url=... --secret supabase_anon_key=...`
# or in the deployment page of the Specific dashboard.
config "supabase_url" {}

secret "supabase_anon_key" {}

build "app" {
  base    = "node"
  command = "pnpm run build"

  # Next.js inlines NEXT_PUBLIC_* variables into the client bundle at build
  # time, so they must be present here as well as at runtime. The Supabase key
  # below is the public anon/publishable key: RLS enforces access.
  env = {
    NODE_ENV                      = "production"
    NEXT_PUBLIC_SITE_URL          = "https://${service.web.public_url}"
    NEXT_PUBLIC_SUPABASE_URL      = "https://wextsivilupiimgmleug.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleHRzaXZpbHVwaWltZ21sZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjU3NDUsImV4cCI6MjEwNzkwMTc0NX0.JRPJIev_joctwf-eM4A5kymvQoBsS2l9qoAZ0qpmmCw"
  }
}

service "web" {
  build   = build.app
  command = "pnpm run start"

  endpoint {
    public = true
    health_check {
      path = "/api/health"
    }
  }

  env = {
    PORT                          = port
    NEXT_PUBLIC_SITE_URL          = "https://${service.web.public_url}"
    NEXT_PUBLIC_SUPABASE_URL      = config.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY = secret.supabase_anon_key
  }

  dev {
    command = "pnpm exec next dev"
    env = {
      NEXT_PUBLIC_SITE_URL = "http://${service.web.public_url}"
    }
  }
}
