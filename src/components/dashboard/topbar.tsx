"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  Search,
  Settings2,
  UserRound,
} from "lucide-react";

import { LogoMark } from "@/components/logo";
import { MobileSidebar } from "@/components/dashboard/sidebar";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";

/* The header mirrors the reference: a logo chip on the left, the primary
   sections as centered pills, and search, notifications, help and the account
   chip on the right. The full section list lives in the icon rail. */
const primaryTabs = [
  { label: "Overview", href: "/app/overview" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Transactions", href: "/app/transactions" },
  { label: "Alerts", href: "/app/alerts" },
  { label: "Network", href: "/app/network" },
  { label: "Reports", href: "/app/reports" },
];

function tabIsActive(pathname: string, href: string) {
  if (href === "/app/settings/profile") return pathname.startsWith("/app/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
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
          className="flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card pl-1 pr-2 text-left shadow-sm transition-colors hover:bg-muted/60 md:pr-3"
          aria-label={`Account menu for ${userName || email}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[11px] font-semibold text-accent">
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
    organizationName: string;
    organizationSlug: string;
    userName: string;
    role: string;
    email: string;
    openAlerts: number;
  };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl md:px-5">
      <div className="flex items-center gap-2">
        <MobileSidebar openAlerts={props.sidebar.openAlerts} />
        <Link
          href="/app/overview"
          aria-label="Aegis overview"
          className="flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card pl-1.5 pr-3.5 shadow-sm transition-colors hover:bg-muted/60"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-elevated">
            <LogoMark className="size-[17px] text-accent" />
          </span>
          <span className="font-display text-[13.5px] font-semibold leading-none tracking-[-0.02em]">Aegis</span>
        </Link>
      </div>

      <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 lg:flex">
        {primaryTabs.map((tab) => {
          const active = tabIsActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors xl:px-4",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("sf:open-command"))}
          className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Search transactions, entities, corridors and datasets (⌘K)"
          title="Search (⌘K)"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>

        <NotificationBell userId={props.userId} />

        <Link
          href="/docs"
          className="hidden size-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground md:flex"
          aria-label="Documentation and help"
          title="Documentation and help"
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </Link>

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
