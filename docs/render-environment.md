# Render environment

The deployment at https://aegis22.onrender.com reads its configuration from
**Render → aegis22 → Environment**, not from the repository. Render builds the
Docker-free Node image from git and injects environment variables at boot; a
`.env` file in the repo would be ignored, and committing real keys would publish
them to everyone with repository access (and to anyone who has ever cloned it).

Keep values in Render's encrypted store. `.env.local` stays on your machine and
is already git-ignored.

## What is live today

`GET /api/health` reports which integrations have credentials, without revealing
them:

```json
{
  "status": "ok",
  "release": "73cf829",
  "integrations": {
    "supabase": true,
    "ai": false,
    "fx": { "provider": "frankfurter", "ready": true },
    "email": false,
    "rateLimit": false
  }
}
```

`ai: false` is why the analyst page says the provider is not configured:
`RIVER_API_KEY` exists in `.env.local` but was never added to Render.

## Variables to set

| Variable | Required | Where the value comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | recommended | `https://aegis22.onrender.com` (code falls back to `RENDER_EXTERNAL_URL`) |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase → Project Settings → API. Baked-in fallback exists |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Same page. Publishable key; browsers are meant to see it |
| `RIVER_API_KEY` | **yes for AI** | River dashboard → API keys. Server-only |
| `RIVER_BASE_URL` | no | `https://api.river.ai/v1` (default) |
| `RIVER_MODEL` | no | `deepseek-ai/DeepSeek-V4.1-Flash` (default) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase → Project Settings → API. Server-only, bypasses RLS |
| `RESEND_API_KEY` | no | Resend dashboard. Enables invite/digest email |
| `RATE_LIMIT_REDIS_URL` | no | Any Redis-compatible URL; falls back to per-instance memory |
| `SUPABASE_STORAGE_BUCKET_REPORTS` | no | defaults to `reports` |
| `SCORING_MODEL_VERSION` | no | defaults to `v1` |

Optional integrations degrade loudly rather than silently: the analyst returns
`503 ai_not_configured`, and the integrations page in the app lists which keys
are missing.

## Adding the AI key

1. Open Render → **aegis22** → **Environment**.
2. **Add Environment Variable**: key `RIVER_API_KEY`, value from
   `RIVER_API_KEY=` in `.env.local` (or a fresh key from River).
3. Add `RIVER_BASE_URL` = `https://api.river.ai/v1` and `RIVER_MODEL` =
   `deepseek-ai/DeepSeek-V4.1-Flash`. These have code defaults; set them only if
   you want them visible next to the key.
4. **Save Changes**. Render redeploys automatically.
5. Check `https://aegis22.onrender.com/api/health` → `"ai": true`, then open
   `/app/analyst` and ask a question.

### Setting them without the dashboard

Render's API accepts the whole set in one call:

```bash
curl -X PUT "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"key":"RIVER_API_KEY","value":"..."}]'
```

A `PUT` replaces the entire environment, so send every variable you want to
keep, not just the new one. `GET /v1/services?name=aegis22` returns the
`SERVICE_ID`.

## Supabase Auth settings that live outside this repo

- **Authentication → URL Configuration → Redirect URLs** must include
  `https://aegis22.onrender.com/auth/callback` (and
  `http://localhost:3100/auth/callback` for local work). OAuth and confirmation
  emails fail after the redirect otherwise.
- **Site URL** should be `https://aegis22.onrender.com` so confirmation emails
  link to Render rather than localhost. Emails sent before this was set cannot
  be repaired; request a new one.
- **Authentication → Providers → Google** is already enabled, which is why
  `/api/auth/providers` reports `google: true`. It still needs the Google client
  ID/secret in that same screen.
- Supabase's built-in SMTP is rate limited to a few messages per hour. For real
  signups, configure **Authentication → Emails → SMTP** with Resend.
