import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-pill bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Skip to main content
      </a>
      <SiteNav />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
