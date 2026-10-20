import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme-provider";
import { siteConfig } from "@/config/site";
import {
  readServerSupabaseConfig,
  SUPABASE_ANON_KEY_META,
  SUPABASE_URL_META,
} from "@/lib/supabase/public-config";
import "./globals.css";

// Fonts are self-hosted through next/font/local so builds never depend on a
// font CDN and the browser makes no third-party requests.
//
// Instrument Sans is a narrow-oblique grotesk built for dense UI: tighter
// apertures than Inter, so figures and labels read as instrumentation rather
// than as a SaaS default.
const sans = localFont({
  display: "swap",
  variable: "--font-sans",
  src: [
    { path: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2", weight: "400 700", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-italic.woff2", weight: "400 700", style: "italic" },
  ],
});

// Headings get a looser, more eccentric grotesk. Bricolage's slightly uneven
// terminals stop the marketing pages reading as a Vercel clone while staying
// perfectly legible at 5rem.
const display = localFont({
  display: "swap",
  variable: "--font-display",
  src: [
    { path: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", weight: "300 800", style: "normal" },
  ],
});

// A single italic serif, used only for the emphasis word in display headings.
// It gives the copy a human note the grotesk alone cannot, at one weight.
const serif = localFont({
  display: "swap",
  variable: "--font-serif",
  src: [
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
});

const mono = localFont({
  display: "swap",
  variable: "--font-mono",
  src: [
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Catch dirty money before it crosses`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "AML monitoring",
    "cross-border payments",
    "transaction monitoring",
    "financial crime compliance",
    "sanctions screening",
    "SAR reporting",
  ],
  authors: [{ name: siteConfig.legalName }],
  creator: siteConfig.legalName,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Catch dirty money before it crosses`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Catch dirty money before it crosses`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F13" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Rendered per request for dynamic pages and from the public fallback for
  // static ones, so browser auth does not depend on build-time env injection.
  const publicSupabase = readServerSupabaseConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta name={SUPABASE_URL_META} content={publicSupabase.url} />
        <meta name={SUPABASE_ANON_KEY_META} content={publicSupabase.anonKey} />
      </head>
      <body className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
