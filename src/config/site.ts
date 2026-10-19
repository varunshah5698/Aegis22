export const siteConfig = {
  name: "Aegis",
  legalName: "Aegis Intelligence Ltd.",
  tagline: "Catch illicit cross-border flows before they settle.",
  description:
    "Aegis scores cross-border payments in real time, explains every risk decision, and moves flagged activity through investigation to regulatory reporting.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3100",
  locale: "en_US",
  contactEmail: "compliance@aegis.example",
  supportEmail: "support@aegis.example",
  demoVideoUrl: "",
  socials: {
    github: "https://github.com/aegis-example",
    linkedin: "https://www.linkedin.com/company/aegis-example",
    x: "https://x.com/aegis",
  },
  demoBookingUrl: "/contact?intent=demo",
} as const;

export const marketingNav = [
  { label: "Product", href: "/#product" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Security", href: "/security" },
] as const;

export const appNav = [
  {
    label: "Monitor",
    items: [
      { label: "Overview", href: "/app/overview", shortcut: "g o", icon: "gauge" },
      { label: "Analytics", href: "/app/analytics", shortcut: "g y", icon: "chart" },
      { label: "Transactions", href: "/app/transactions", shortcut: "g t", icon: "arrow-left-right" },
      { label: "Corridors", href: "/app/corridors", shortcut: "g c", icon: "globe" },
      { label: "FX intelligence", href: "/app/fx", shortcut: "g f", icon: "banknote" },
    ],
  },
  {
    label: "Investigate",
    items: [
      { label: "Alerts", href: "/app/alerts", shortcut: "g a", icon: "shield-alert", badge: "alerts" },
      { label: "Network", href: "/app/network", shortcut: "g n", icon: "network" },
      { label: "Structuring", href: "/app/structuring", shortcut: "", icon: "layers" },
      { label: "Cases", href: "/app/cases", shortcut: "g k", icon: "folder" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI analyst", href: "/app/analyst", shortcut: "g i", icon: "sparkles" },
      { label: "Data library", href: "/app/library", shortcut: "g d", icon: "database" },
    ],
  },
  {
    label: "Configure",
    items: [
      { label: "Rules", href: "/app/rules", shortcut: "g r", icon: "sliders" },
      { label: "Reports", href: "/app/reports", shortcut: "", icon: "file-text" },
      { label: "Settings", href: "/app/settings/profile", shortcut: "", icon: "settings" },
    ],
  },
] as const;

export const footerNav = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/#product" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "API overview", href: "/docs/api" },
      { label: "Webhooks", href: "/docs/webhooks" },
      { label: "Glossary", href: "/docs/glossary" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Book a demo", href: "/contact?intent=demo" },
      { label: "Log in", href: "/login" },
      { label: "Start free trial", href: "/signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
] as const;

export const docsNav = [
  { label: "Quickstart", href: "/docs/quickstart", description: "Score your first transactions in ten minutes." },
  { label: "API overview", href: "/docs/api", description: "Authentication, envelopes, pagination and errors." },
  { label: "Webhooks", href: "/docs/webhooks", description: "Signed delivery of alerts and case events." },
  { label: "Glossary", href: "/docs/glossary", description: "Compliance and product terms used throughout." },
] as const;

export const settingsNav = [
  { label: "Profile", href: "/app/settings/profile" },
  { label: "Organization", href: "/app/settings/organization" },
  { label: "Team", href: "/app/settings/team" },
  { label: "API keys", href: "/app/settings/api-keys" },
  { label: "Notifications", href: "/app/settings/notifications" },
  { label: "Audit log", href: "/app/settings/audit-log" },
] as const;

export const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zurich",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "hi", label: "हिन्दी" },
] as const;
