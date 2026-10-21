import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AssistantDrawer } from "@/components/dashboard/assistant-drawer";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { KeyboardShortcuts } from "@/components/dashboard/keyboard-shortcuts";
import { IconRail } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { requireOrganization } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) redirect("/onboarding");

  const { count } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .in("status", ["new", "investigating", "escalated"]);

  const sidebar = {
    organizationName: organization.name,
    organizationSlug: organization.slug,
    userName: profile.full_name || profile.email,
    role: profile.role,
    email: profile.email,
    openAlerts: count ?? 0,
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-pill bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Skip to main content
      </a>
      <IconRail openAlerts={sidebar.openAlerts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar userId={user.id} sidebar={sidebar} />
        <main id="main-content" className="app-canvas flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <AssistantDrawer />
      </Suspense>
      <CommandPalette userId={user.id} />
      <KeyboardShortcuts />
    </div>
  );
}
