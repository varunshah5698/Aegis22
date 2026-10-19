/**
 * Documentation is stored as structured content rather than MDX so the docs
 * render as part of the same typed build. Each block maps to a small renderer;
 * adding a page is a data change, not a routing change.
 */

export interface DocBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: { language: string; label: string; value: string };
  callout?: { tone: "note" | "warning"; title: string; body: string };
}

export interface Doc {
  slug: string;
  title: string;
  description: string;
  readingMinutes: number;
  blocks: DocBlock[];
}

export const docs: Doc[] = [
  {
    slug: "quickstart",
    title: "Quickstart",
    description: "Score your first transactions in about ten minutes.",
    readingMinutes: 6,
    blocks: [
      {
        paragraphs: [
          "This guide takes you from a fresh clone to a scored batch in your own organization. The reference project already contains 10,000 seeded transactions, so you can compare your results against documented typologies before connecting anything real.",
        ],
      },
      {
        heading: "1. Create an account and organization",
        paragraphs: [
          "Sign up with your work email, verify the address, then complete onboarding. Onboarding either creates an organization or attaches you to one you were invited to. Your role is viewer until an administrator changes it.",
        ],
        bullets: [
          "Signup enforces a 12-character password with a number and a symbol.",
          "Invitations carry a role and expire after seven days.",
          "Administrators can require TOTP multi-factor authentication for the whole organization.",
        ],
      },
      {
        heading: "2. Get an API key",
        paragraphs: [
          "Open Settings → API keys, create a key with the scopes you need, and copy it immediately. The raw value is shown once; only a SHA-256 hash is stored. The first eight characters are kept as a prefix so you can identify the key later.",
        ],
        code: {
          language: "bash",
          label: "Create and use a key",
          value: `# Create in the UI, then export it locally\nexport AEGIS_KEY=\"sf_live_...\"\n\ncurl -s https://your-deployment.example/api/score \\\n  -H \"Authorization: Bearer $AEGIS_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d @transaction.json`,
        },
      },
      {
        heading: "3. Score a transaction",
        paragraphs: [
          "Amounts are strings with up to two decimals so precision never depends on floating point. Countries are ISO 3166-1 alpha-2 and currencies are ISO 4217. Timestamps must include an offset.",
        ],
        code: {
          language: "json",
          label: "transaction.json",
          value: `{
  "external_id": "PAY-2026-000981",
  "amount": "9480.00",
  "currency": "USD",
  "sender_account_id": "a5e110000-0000-4000-8000-000000000001",
  "receiver_account_id": "abe9e0000-0000-4000-8000-000000000001",
  "sender_country": "AE",
  "receiver_country": "IR",
  "channel": "SWIFT",
  "purpose_code": "TRADE",
  "created_at": "2026-10-18T09:42:18+04:00"
}`,
        },
      },
      {
        heading: "4. Read the response",
        paragraphs: [
          "The response returns the score, the level, the model version, and the contribution of every signal with the facts behind it. Store the model version with the decision; a later score from a new model is not comparable.",
        ],
        code: {
          language: "json",
          label: "Response",
          value: `{
  "data": {
    "score": 78,
    "level": "high",
    "model_version": "v1",
    "explanation": "Splitting window and high-risk corridor drove this score.",
    "contributions": [
      { "id": "splitting_window", "points": 18, "triggered": true,
        "facts": { "transaction_count": 9, "related_accounts": 2 } }
    ]
  },
  "error": null,
  "meta": { "requestId": "5d1f..." }
}`,
        },
      },
      {
        heading: "5. Ingest a batch",
        paragraphs: [
          "Bulk ingest accepts up to 500 transactions per request and is idempotent on external_id. Re-sending a batch updates nothing and reports the duplicate count instead of creating a second payment.",
        ],
        callout: {
          tone: "note",
          title: "Ordering matters for clusters",
          body: "Score in timestamp order when replaying history. The splitting and circular-path signals depend on transactions that arrived earlier in the window.",
        },
      },
    ],
  },
  {
    slug: "api",
    title: "API overview",
    description: "Authentication, envelopes, pagination, errors and rate limits.",
    readingMinutes: 8,
    blocks: [
      {
        heading: "Base URL and versioning",
        paragraphs: [
          "All routes live under /api on the deployment origin. The response envelope is stable: data, error and meta. Breaking changes ship behind a new route version rather than silently changing a field.",
        ],
        code: {
          language: "text",
          label: "Envelope",
          value: `{ data: T | null, error: { code, message, details? } | null, meta: { requestId, ... } }`,
        },
      },
      {
        heading: "Authentication",
        paragraphs: [
          "Browser requests use the session cookie. Server-to-server requests use Authorization: Bearer <api_key>. Keys are hashed with SHA-256 before storage, can be scoped, and can be revoked immediately.",
        ],
        bullets: [
          "Missing or invalid credentials return 401 with code unauthorized.",
          "A signed-in user without the required role receives 403 with code forbidden.",
          "API keys never grant cross-organization access.",
        ],
      },
      {
        heading: "Endpoints",
        bullets: [
          "POST /api/score — score one transaction or an array of up to 500.",
          "POST /api/transactions/ingest — bulk insert with idempotency on external_id.",
          "GET /api/transactions — cursor pagination with corridor, risk and date filters.",
          "GET /api/alerts, PATCH /api/alerts/:id, POST /api/alerts/bulk — triage up to 200 alerts.",
          "GET/POST /api/cases, PATCH /api/cases/:id, POST /api/cases/:id/notes — investigations.",
          "GET/POST /api/rules, POST /api/rules/:id/publish, POST /api/rules/:id/simulate.",
          "POST /api/reports, GET /api/reports/:id/download — signed links expire after 300 seconds.",
          "GET /api/health — liveness, database reachability and model version.",
        ],
      },
      {
        heading: "Pagination",
        paragraphs: [
          "List endpoints use cursor pagination. Pass the opaque cursor from meta.nextCursor to fetch the next page. Page size defaults to 50 and is capped at 200; sorting is stable on (created_at, id).",
        ],
        code: {
          language: "bash",
          label: "Next page",
          value: `curl -s \"$BASE/api/transactions?limit=50&cursor=$CURSOR\" \\\n  -H \"Authorization: Bearer $AEGIS_KEY\"`,
        },
      },
      {
        heading: "Errors",
        paragraphs: [
          "Errors use a machine-readable code and a human message. Validation failures return 422 with field-level details; rate limits return 429 with Retry-After. Do not retry 4xx responses other than 409 and 429.",
        ],
        code: {
          language: "json",
          label: "Validation error",
          value: `{\n  \"data\": null,\n  \"error\": {\n    \"code\": \"validation_error\",\n    \"message\": \"The request body did not pass validation.\",\n    \"details\": { \"fieldErrors\": { \"amount\": [\"Amount must be a decimal string\"] } }\n  },\n  \"meta\": { \"requestId\": \"9a2c...\" }\n}`,
        },
      },
      {
        heading: "Rate limits and idempotency",
        paragraphs: [
          "Limits are sliding windows per key or user, currently 300 requests per minute. Every response carries RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset. Send an Idempotency-Key header on POST requests that create money-moving records; the stored response is replayed for 24 hours.",
        ],
      },
    ],
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    description: "Signed delivery of alert and case events, with retries and replay.",
    readingMinutes: 5,
    blocks: [
      {
        heading: "Events",
        bullets: [
          "alert.created — a transaction crossed the alert cutoff.",
          "alert.status_changed — triage moved an alert.",
          "case.created — an investigation was opened.",
          "report.ready — a queued report finished and can be downloaded.",
        ],
      },
      {
        heading: "Signature verification",
        paragraphs: [
          "Each delivery includes Aegis-Signature: t=<unix>,v1=<hex>. Compute HMAC-SHA256 over the timestamp, a dot, and the raw request body using your signing secret, then compare in constant time. Reject timestamps older than five minutes to prevent replays.",
        ],
        code: {
          language: "ts",
          label: "verify.ts",
          value: `import { createHmac, timingSafeEqual } from \"node:crypto\";\n\nexport function verify(raw: string, header: string, secret: string) {\n  const parts = Object.fromEntries(header.split(\",\").map((p) => p.split(\"=\")));\n  const timestamp = Number(parts.t);\n  if (!Number.isFinite(timestamp) || Date.now() / 1000 - timestamp > 300) return false;\n  const expected = createHmac(\"sha256\", secret).update(\`\${parts.t}.\${raw}\`).digest(\"hex\");\n  const received = Buffer.from(parts.v1 ?? \"\", \"hex\");\n  const digest = Buffer.from(expected, \"hex\");\n  return received.length === digest.length && timingSafeEqual(received, digest);\n}`,
        },
      },
      {
        heading: "Retries",
        paragraphs: [
          "Deliveries retry with exponential backoff for 24 hours: 30 seconds, 2 minutes, 10 minutes, then hourly. A 2xx response acknowledges the event. Anything else is retried; a 410 disables the endpoint until it is re-enabled in settings.",
        ],
        callout: {
          tone: "warning",
          title: "Deliveries are at least once",
          body: "Store the event id and ignore duplicates. The event payload is immutable; a later state change arrives as a new event.",
        },
      },
      {
        heading: "Local testing",
        paragraphs: [
          "The reference deployment signs with the secret stored in your organization settings. For local work, expose your handler with a tunnel and create a test endpoint; the signature header is identical to production.",
        ],
      },
    ],
  },
  {
    slug: "glossary",
    title: "Glossary",
    description: "The compliance and product terms used throughout Aegis.",
    readingMinutes: 4,
    blocks: [
      {
        heading: "Detection terms",
        bullets: [
          "Signal — one independent risk indicator with a 0–1 value and the facts behind it.",
          "Contribution — the points a signal adds to the 0–100 score, after weighting.",
          "Alert cutoff — the score at which an alert is created. Default 60, configurable per organization.",
          "Splitting (structuring) — several sub-threshold payments whose sum crosses a reporting threshold inside a rolling window.",
          "Pass-through — an account that forwards most of the value it receives within hours.",
          "Circular flow — value that returns to its originator through two to four hops inside 72 hours.",
          "Corridor — the ordered pair of sender and receiver jurisdictions, for example AE→IR.",
        ],
      },
      {
        heading: "Investigation terms",
        bullets: [
          "Triage — the first review of an alert: assign, accept, escalate or dismiss with a reason.",
          "SLA — the time allowed before an alert is due, derived from severity.",
          "Case — a container for related alerts, entities, evidence and notes.",
          "SAR-style summary — an internal narrative export structured like a suspicious activity report. It is not a regulatory filing.",
          "False positive — a resolved alert where the activity was legitimate; the reason feeds tuning.",
        ],
      },
      {
        heading: "Model terms",
        bullets: [
          "Model version — stamped on every score so decisions remain reproducible.",
          "Weighted ensemble — the optional scorer that combines rule signals with a logistic model.",
          "Backtest (simulation) — running a draft rule against historical transactions before publishing.",
          "Deterministic — identical inputs and context always produce the identical score.",
        ],
      },
      {
        heading: "Roles",
        bullets: [
          "Admin — team, keys, rules publishing and organization settings.",
          "Analyst — triage, investigations and draft rules.",
          "Viewer — read-only access to dashboards, alerts and reports.",
        ],
      },
    ],
  },
];

export function getDoc(slug: string): Doc | undefined {
  return docs.find((doc) => doc.slug === slug);
}
