import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Logo } from "@/components/logo";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Set up your workspace",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login?next=/onboarding");
  if (!context.user.email_confirmed_at) redirect("/verify-email");
  if (context.profile.organization_id) redirect("/app/library");

  const metadata = context.user.user_metadata ?? {};
  const organizationName = typeof metadata.organization_name === "string" ? metadata.organization_name : "";

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="container-page flex h-20 items-center justify-between">
        <Logo />
        <p className="text-xs text-muted-foreground">One step left</p>
      </div>
      <main id="main-content" className="container-page flex flex-1 items-start justify-center py-6 md:items-center md:py-10">
        <div className="w-full max-w-[520px] rounded-hero border-2 border-foreground/15 bg-card p-6 shadow-card md:p-8">
          <OnboardingForm
            defaultName={context.profile.full_name || ""}
            defaultOrganization={organizationName}
            defaultTimezone={context.profile.timezone || "UTC"}
          />
        </div>
      </main>
    </div>
  );
}
