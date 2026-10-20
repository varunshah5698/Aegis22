"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, PanelLeft } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MODEL_VERSION, SCORE_BANDS } from "@/config/risk";
import { dashboardIcons } from "@/components/dashboard/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { appNav } from "@/config/site";
import { cn } from "@/lib/utils";

interface SidebarProps {
  defaultCollapsed: boolean;
  organizationName: string;
  organizationSlug: string;
  userName: string;
  role: string;
  email: string;
  openAlerts: number;
}

function NavContent({
  collapsed,
  openAlerts,
  onNavigate,
}: {
  collapsed: boolean;
  openAlerts: number;
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-2.5 py-3">
      {appNav.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {!collapsed ? (
            <p className="px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
              {group.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden="true" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = dashboardIcons[item.icon] ?? PanelLeft;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate?.()}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex h-[34px] items-center gap-2.5 rounded-pill px-2.5 text-[12.5px] transition-colors",
                      active
                        ? "bg-foreground font-medium text-background shadow-sm"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-background" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                    {!collapsed && "badge" in item && item.badge === "alerts" && openAlerts > 0 ? (
                      <span className="num rounded-[5px] bg-risk-critical/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-risk-critical">
                        {openAlerts > 99 ? "99+" : openAlerts}
                      </span>
                    ) : null}
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

function SidebarChrome({
  collapsed,
  openAlerts,
  onNavigate,
}: Pick<SidebarProps, "openAlerts"> & { collapsed: boolean; onNavigate?: (() => void) | undefined }) {
  return (
    <>
      <div
        className={cn(
          "flex h-[60px] shrink-0 items-center border-b border-border/60",
          collapsed ? "justify-center" : "gap-2.5 px-4",
        )}
      >
        <LogoMark className="size-7 shrink-0" />
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate font-display text-[14px] font-semibold leading-4 tracking-[-0.02em]">
              Aegis
            </span>
            <span className="block truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Financial intelligence
            </span>
          </span>
        ) : null}
      </div>

      <NavContent collapsed={collapsed} openAlerts={openAlerts} onNavigate={onNavigate} />

      <div className="shrink-0 border-t border-border/60 px-2.5 py-2.5">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-risk-low opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-risk-low" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
              Scoring live · model {MODEL_VERSION} · cutoff {SCORE_BANDS.alert}
            </p>
          </div>
        ) : null}
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1.5" : "justify-between px-1")}>
          <ThemeToggle className="size-7" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("sf:toggle-sidebar"))}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed ? "w-7 justify-center" : "px-1.5",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-3.5" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="size-3.5" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(props.defaultCollapsed);

  React.useEffect(() => {
    const onToggle = () => {
      setCollapsed((current) => {
        const next = !current;
        document.cookie = `sf-sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
        return next;
      });
    };
    window.addEventListener("sf:toggle-sidebar", onToggle);
    return () => window.removeEventListener("sf:toggle-sidebar", onToggle);
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border/70 bg-card transition-[width] duration-200 lg:flex",
        collapsed ? "w-[64px]" : "w-[236px]",
      )}
    >
      <SidebarChrome collapsed={collapsed} openAlerts={props.openAlerts} />
    </aside>
  );
}

export function MobileSidebar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
          <PanelLeft aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[272px] flex-col gap-0 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarChrome collapsed={false} openAlerts={props.openAlerts} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
