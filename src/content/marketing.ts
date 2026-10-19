/**
 * Marketing copy lives here so product, legal and design can edit it without
 * touching layout code. Claims about standards are deliberately phrased as
 * "designed to align with" — certification language needs legal review.
 */

export const trustMetrics = [
  { value: 42, suffix: "M+", label: "transactions scanned daily", detail: "Peak sustained throughput across demo deployments." },
  { value: 200, prefix: "<", suffix: " ms", label: "median detection latency", detail: "Ingest to scored, at the 50th percentile." },
  { value: 96, suffix: "%", label: "analyst-validated precision", detail: "On flagged items in the reference backtest." },
] as const;

export const problems = [
  {
    id: "flows",
    title: "Unusual fund flows",
    body: "A corridor that was quiet for months suddenly carries triple its normal value. Rules that only look at one payment at a time miss it entirely.",
    stat: "5.4×",
    statLabel: "volume surge, 48 hours",
  },
  {
    id: "intermediaries",
    title: "Suspicious intermediaries",
    body: "Pass-through companies receive value and forward almost all of it within hours. Shells incorporated weeks ago look identical to legitimate traders in a payment message.",
    stat: "91%",
    statLabel: "forwarded within 6 hours",
  },
  {
    id: "splitting",
    title: "Transaction splitting",
    body: "Payments stop just short of a reporting threshold, then repeat from related accounts. Each payment looks ordinary; the cluster does not.",
    stat: "7 × 9,400",
    statLabel: "under 10,000 threshold",
  },
  {
    id: "corridors",
    title: "High-risk corridors",
    body: "A first-time transfer to a restricted jurisdiction, in a currency that does not match the customer's profile, is a different risk from a routine corridor.",
    stat: "3 hops",
    statLabel: "A → B → C → A in 72h",
  },
] as const;

export const steps = [
  {
    title: "Ingest",
    body: "Send payments by API, webhook or batch file. Every message is validated against ISO 20022-style fields, deduplicated on your external id, and time-stamped in UTC.",
    detail: "500 transactions per request · idempotent",
  },
  {
    title: "Score",
    body: "Ten independent signals run in a deterministic engine: value, velocity, corridor, counterparty novelty, splitting, circular paths, intermediary behaviour, currency fit and PEP exposure.",
    detail: "Sub-200 ms median · versioned model",
  },
  {
    title: "Explain",
    body: "Every score ships with weighted contributions, the raw feature values behind them, and a plain-language summary an analyst can paste into a case file.",
    detail: "No unexplained decisions",
  },
  {
    title: "Act",
    body: "Alerts route to the right analyst with an SLA clock. Investigate in a case, attach evidence, then export a SAR-style summary with a full audit trail.",
    detail: "Evidence stays attached",
  },
] as const;

export const features = [
  {
    id: "scoring",
    title: "Real-time scoring",
    body: "Every payment is scored on ingest and again when context changes, so a transaction that looked ordinary at 09:00 is re-evaluated when its cluster completes.",
    href: "/docs/quickstart",
  },
  {
    id: "explainability",
    title: "Explainable decisions",
    body: "Analysts see which signals fired, how many points each contributed, and the concrete values behind them — then a sentence they can hand to a reviewer.",
    href: "/docs/api",
  },
  {
    id: "network",
    title: "Network graph analysis",
    body: "Follow value across accounts, intermediaries and jurisdictions. Focus mode isolates a node's neighbours; the force layout runs in a worker so the canvas stays responsive.",
    href: "/docs/glossary",
  },
  {
    id: "rules",
    title: "Rule builder with backtesting",
    body: "Compose conditions with AND/OR groups, preview the generated logic, then simulate a draft against the last 30 days before publishing an immutable version.",
    href: "/docs/quickstart",
  },
  {
    id: "cases",
    title: "Case management",
    body: "Alerts become cases with owners, priorities, linked entities, attachments and a notes timeline. Mentions notify teammates; every action is audited.",
    href: "/docs/glossary",
  },
  {
    id: "reporting",
    title: "Regulatory reporting",
    body: "Generate SAR-style summaries, daily digests and audit exports as PDF or CSV. Downloads use short-lived signed links and are recorded against the requester.",
    href: "/docs/api",
  },
] as const;

export const testimonials = [
  {
    quote:
      "We stopped reconciling three spreadsheets every morning. The alert explains itself, so first-line review takes minutes instead of an hour.",
    name: "Amara Okafor",
    role: "Head of Financial Crime",
    company: "Meridian Trust Bank",
  },
  {
    quote:
      "The structuring view is the first tool our analysts actually asked to keep. Seeing the cumulative value against the threshold settled a long-running argument about false positives.",
    name: "Daniel Reyes",
    role: "AML Operations Lead",
    company: "Northwind Payments",
  },
  {
    quote:
      "Backtesting a rule against a month of history before publishing changed how our compliance team works with engineering. We ship fewer, better rules.",
    name: "Priya Raman",
    role: "Director of Compliance Technology",
    company: "Halcyon Financial",
  },
] as const;

export const faqs = [
  {
    question: "How is customer data secured?",
    answer:
      "Data is isolated per organization with Postgres row-level security: every query is scoped to the caller's organization, and service credentials never reach the browser. Transport is TLS 1.2+, secrets are held server-side, and sensitive actions are written to an append-only audit log. Access is role-based, with optional enforced MFA for administrators.",
  },
  {
    question: "Where is data stored and in which regions?",
    answer:
      "The hosted deployment runs on managed Postgres in a single region you choose at provisioning, with encrypted backups. Enterprise deployments can be pinned to a dedicated environment. The demo project described in this repository is a shared reference environment and should not hold production data.",
  },
  {
    question: "What is the detection latency?",
    answer:
      "Scoring runs synchronously on ingest. In the reference dataset the median is under 200 ms for a single transaction, and a 10,000-transaction batch scores in about a second on a development machine. End-to-end latency depends on your network path and queueing.",
  },
  {
    question: "How are scores explained?",
    answer:
      "Each of the ten signals returns a 0–1 value with the facts behind it. The engine publishes the weighted contribution of every signal, the model version, and a plain-language summary. Analysts can expand any alert to see raw feature values such as the number of related accounts or the pass-through ratio.",
  },
  {
    question: "Which standards do you align with?",
    answer:
      "The product is designed to align with the FATF risk-based approach and with common SAR/STR narrative expectations. Data handling is designed around GDPR principles, including purpose limitation and deletion on request. We do not claim SOC 2, ISO 27001 or PCI certification for this reference build; certification status must be confirmed contractually.",
  },
  {
    question: "Can we bring our own rules?",
    answer:
      "Yes. Rules are versioned JSON condition trees with AND/OR groups, typed operators and a maximum nesting depth of three. Drafts can be simulated against historical transactions, compared with the active version, and published as immutable versions with a change note and author.",
  },
  {
    question: "How do you handle false positives?",
    answer:
      "Every alert can be resolved as a false positive with a reason, which feeds the tuning workflow rather than disappearing. Thresholds, weights and corridor tiers are configuration, not code, so a compliance team can adjust them with an audit trail. Backtesting shows the alert volume a change would have produced before it ships.",
  },
  {
    question: "How does onboarding work?",
    answer:
      "Create an organization, invite your team and send a test batch through the scoring API. The demo seed loads 10,000 historical transactions with documented typologies so you can compare outcomes before connecting a live feed. A typical pilot reaches its first real corridor review in under an hour.",
  },
] as const;

export const pricingTiers = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For a first monitoring programme.",
    monthly: 490,
    annual: 392,
    volume: "Up to 500k transactions / month",
    seats: "3 seats",
    support: "Email support",
    cta: "Start free trial",
    href: "/signup?plan=starter",
    features: [
      "All ten risk signals",
      "Rule builder and backtesting",
      "Alert triage with SLA clocks",
      "CSV exports",
      "30-day data retention",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For teams running daily investigations.",
    monthly: 1990,
    annual: 1592,
    volume: "Up to 10M transactions / month",
    seats: "15 seats",
    support: "Priority support",
    cta: "Start free trial",
    href: "/signup?plan=growth",
    highlighted: true,
    features: [
      "Everything in Starter",
      "Network graph and focus mode",
      "Structuring detector",
      "Case management with attachments",
      "PDF and CSV regulatory reports",
      "Scheduled daily digest",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For regulated institutions at scale.",
    monthly: null,
    annual: null,
    volume: "Unlimited volume",
    seats: "Unlimited seats",
    support: "Dedicated success manager",
    cta: "Talk to sales",
    href: "/contact?intent=sales",
    features: [
      "Everything in Growth",
      "Custom signals and model weights",
      "SSO and enforced MFA",
      "Dedicated environment and region",
      "SLA and named support contacts",
    ],
  },
] as const;

export const comparisonGroups = [
  {
    title: "Detection",
    rows: [
      { label: "All ten risk signals", starter: true, growth: true, enterprise: true },
      { label: "Custom scoring weights", starter: false, growth: true, enterprise: true },
      { label: "Network graph analysis", starter: false, growth: true, enterprise: true },
      { label: "Structuring detector", starter: false, growth: true, enterprise: true },
      { label: "Rule backtesting", starter: true, growth: true, enterprise: true },
    ],
  },
  {
    title: "Investigation",
    rows: [
      { label: "Alert triage and SLA clocks", starter: true, growth: true, enterprise: true },
      { label: "Case management", starter: false, growth: true, enterprise: true },
      { label: "Attachments and evidence", starter: false, growth: true, enterprise: true },
      { label: "SAR-style PDF reports", starter: false, growth: true, enterprise: true },
      { label: "Scheduled digests", starter: false, growth: true, enterprise: true },
    ],
  },
  {
    title: "Platform",
    rows: [
      { label: "API keys and rate limits", starter: true, growth: true, enterprise: true },
      { label: "Audit log", starter: false, growth: true, enterprise: true },
      { label: "SSO", starter: false, growth: false, enterprise: true },
      { label: "Enforced MFA", starter: false, growth: true, enterprise: true },
      { label: "Dedicated environment", starter: false, growth: false, enterprise: true },
    ],
  },
] as const;
