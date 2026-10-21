"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, PanelLeft } from "lucide-react";

import { dashboardIcons } from "@/components/dashboard/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { appNav } from "@/config/site";
import { cn } from "@/lib/utils";

/* The rail is icon-only, so every destination keeps its label in a tooltip and
   an aria-label; the mobile sheet shows the same list with text. */
function railIsActive(pathname: string, href: string) {
  if (href === "/app/settings/profile") return pathname.startsWith("/app/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
  badge?: number | null;
}) {
  return (
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-full border transition-colors",
            active
              ? "border-foreground bg-foreground text-background shadow-sm"
              : "border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-[17px]" aria-hidden={true} />
          {badge ? (
            <span className="num absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-risk-critical px-1 text-[11px] font-semibold leading-[15px] text-white ring-2 ring-card">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function IconRail({ openAlerts }: { openAlerts: number }) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Workspace"
      className="sticky top-0 hidden h-dvh w-[68px] shrink-0 flex-col items-center border-r border-border/70 bg-card py-3 lg:flex"
    >
      <nav aria-label="Sections" className="no-scrollbar mt-1 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {appNav.map((group, index) => (
          <React.Fragment key={group.label}>
            {index > 0 ? <div className="my-1.5 h-px w-7 shrink-0 bg-border" aria-hidden="true" /> : null}
            {group.items.map((item) => {
              const Icon = dashboardIcons[item.icon] ?? PanelLeft;
              return (
                <RailLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={Icon}
                  active={railIsActive(pathname, item.href)}
                  badge={"badge" in item && item.badge === "alerts" && openAlerts > 0 ? openAlerts : null}
                />
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="mt-3 flex shrink-0 flex-col items-center gap-1">
        <div className="mb-1.5 h-px w-7 bg-border" aria-hidden="true" />
        <Tooltip delayDuration={180}>
          <TooltipTrigger asChild>
            <Link
              href="/docs"
              aria-label="Documentation and help"
              className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CircleHelp className="size-[17px]" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            Documentation and help
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile: the same destinations as a labeled sheet                            */
/* -------------------------------------------------------------------------- */

function NavList({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-4">
      {appNav.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-muted-foreground/65">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = dashboardIcons[item.icon] ?? PanelLeft;
              const active = railIsActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-pill px-2.5 text-[12.5px] transition-colors",
                      active
                        ? "bg-foreground font-medium text-background"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileSidebar({ openAlerts }: { openAlerts: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-10 rounded-full border-border/70 bg-card shadow-sm lg:hidden"
          aria-label="Open navigation"
        >
          <PanelLeft aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[272px] flex-col gap-0 p-0">
        <SheetTitle className="sr-only">Navigation{openAlerts > 0 ? ` · ${openAlerts} open alerts` : ""}</SheetTitle>
        <NavList onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
