"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  LogOut,
  Search,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";

import { MobileSidebar } from "@/components/dashboard/sidebar";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appNav } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";

const pageLabels: Record<string, string> = {
  transactions: "Transactions",
  analytics: "Analytics",
  corridors: "Corridors",
  fx: "FX intelligence",
  analyst: "AI analyst",
  library: "Data library",
  alerts: "Alerts",
  network: "Network",
  structuring: "Structuring",
  rules: "Rules",
  cases: "Cases",
  reports: "Reports",
  settings: "Settings",
};

function usePageTrail(pathname: string) {
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const root = segments[1] ?? "overview";
    const label = root === "overview" ? "Executive overview" : pageLabels[root] ?? "Workspace";
    return { root, label };
  }, [pathname]);
}

function PageSelector({ pathname }: { pathname: string }) {
  const { root, label } = usePageTrail(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-0 items-center gap-2 rounded-tile border border-border bg-elevated/50 px-3 text-[12.5px] font-medium transition-colors hover:border-border-strong hover:bg-elevated"
          aria-label={`Current page: ${label}. Switch page.`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {appNav.map((group) => (
          <div key={group.label} className="mb-1 last:mb-0">
            <DropdownMenuLabel className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </DropdownMenuLabel>
            {group.items.map((item) => {
              const active = root === item.href.split("/")[2];
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className={cn("justify-between", active && "bg-muted/60")}>
                    <span>{item.label}</span>
                    {active ? <Check className="size-3.5 text-accent" aria-hidden="true" /> : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({
  userName,
  role,
  email,
  organizationName,
  organizationSlug,
}: {
  userName: string;
  role: string;
  email: string;
  organizationName: string;
  organizationSlug: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-tile border border-transparent px-1.5 text-left transition-colors hover:border-border hover:bg-muted/60"
          aria-label={`Account menu for ${userName || email}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10.5px] font-semibold">
            {initials(userName || email)}
          </span>
          <span className="hidden min-w-0 leading-4 xl:block">
            <span className="block max-w-[150px] truncate text-[12px] font-medium">{userName || email}</span>
            <span className="block max-w-[150px] truncate text-[10px] capitalize text-muted-foreground">{role}</span>
          </span>
          <ChevronDown className="hidden size-3.5 shrink-0 text-muted-foreground xl:block" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block text-xs font-medium">{organizationName}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">
            /{organizationSlug} · {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile">
            <UserRound className="size-4" aria-hidden="true" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/organization">
            <Settings2 className="size-4" aria-hidden="true" /> Organization
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/notifications">
            <Bell className="size-4" aria-hidden="true" /> Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="text-risk-critical focus:text-risk-critical">
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardTopbar(props: {
  userId: string;
  sidebar: {
    defaultCollapsed: boolean;
    organizationName: string;
    organizationSlug: string;
    userName: string;
    role: string;
    email: string;
    openAlerts: number;
  };
}) {
  const pathname = usePathname();
  const onCases = pathname.startsWith("/app/cases");

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-xl md:px-4">
      <MobileSidebar {...props.sidebar} />

      <div className="flex min-w-0 items-center gap-2">
        <PageSelector pathname={pathname} />
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("sf:open-command"))}
        className="mx-auto hidden h-9 w-full max-w-[420px] items-center gap-2 rounded-tile border border-border bg-elevated/40 px-3 text-[12.5px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground md:flex"
        aria-label="Search transactions, entities, corridors and datasets"
      >
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Ask AI or search transactions, corridors, datasets…</span>
        <span className="kbd shrink-0">⌘K</span>
      </button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("aegis:assistant"))}
          className="flex size-9 items-center justify-center rounded-tile text-accent transition-colors hover:bg-accent/10"
          aria-label="Open the AI analyst"
          title="Ask the AI analyst (⌘J)"
        >
          <Sparkles className="size-4" aria-hidden="true" />
        </button>

        <NotificationBell userId={props.userId} />

        <Link
          href="/docs"
          className="hidden size-9 items-center justify-center rounded-tile text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
          aria-label="Documentation and help"
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </Link>

        {!onCases ? (
          <Button asChild size="sm" variant="outline" className="hidden h-9 gap-1.5 text-[12px] xl:inline-flex">
            <Link href="/app/cases">New case</Link>
          </Button>
        ) : null}

        <AccountMenu
          userName={props.sidebar.userName}
          role={props.sidebar.role}
          email={props.sidebar.email}
          organizationName={props.sidebar.organizationName}
          organizationSlug={props.sidebar.organizationSlug}
        />
      </div>
    </header>
  );
}
