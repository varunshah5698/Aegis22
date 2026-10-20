"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { marketingNav, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  // The home page opens on a night stage; the nav has to belong to it.
  const night = pathname === "/";

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-[height,background-color,border-color] duration-300",
        night ? "text-[#EDF1F8]" : "text-foreground",
        scrolled ? "h-16" : "h-[72px]",
        night
          ? scrolled
            ? "border-white/[0.08] bg-[#05080F]/85 backdrop-blur-xl"
            : "border-transparent bg-[#05080F]"
          : scrolled
            ? "border-border bg-background/85 backdrop-blur-md"
            : "border-transparent bg-background",
      )}
    >
      <div className="container-page flex h-full items-center justify-between gap-6">
        <Logo tone={night ? "night" : "default"} />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-pill px-3 py-2 text-[13px] transition-colors",
                night
                  ? "text-white/55 hover:bg-white/[0.06] hover:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            asChild
            className={night ? "text-white/60 hover:bg-white/[0.06] hover:text-white" : undefined}
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Link
            href="/signup"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-pill px-4 text-[13px] font-medium transition-colors",
              night
                ? "bg-[#F0B250] text-[#0B0F17] hover:bg-[#FFC46B]"
                : "bg-accent text-accent-foreground hover:bg-accent/90",
            )}
          >
            Start free
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("md:hidden", night && "text-white/70 hover:bg-white/[0.06] hover:text-white")}
              aria-label="Open menu"
            >
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Navigate</SheetTitle>
              <SheetDescription>Product, pricing and security.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {marketingNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 font-display text-lg font-medium tracking-tight hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="accent" asChild>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href={siteConfig.demoBookingUrl}>Book a demo</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
