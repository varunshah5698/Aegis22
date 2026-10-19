import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";

import { ResendVerification } from "@/components/auth/resend-verification";
import { Logo } from "@/components/logo";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login?next=/verify-email");

  const { user, profile } = context;
  if (user.email_confirmed_at) {
    redirect(profile.organization_id ? "/app/overview" : "/onboarding");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="container-page flex h-20 items-center">
        <Logo />
      </div>
      <main id="main-content" className="container-page flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md space-y-5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent">
            <MailCheck className="size-6 text-accent-foreground" aria-hidden="true" />
          </span>
          <h1 className="text-display-md">Verify your email</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Your workspace stays locked until the address is confirmed. Open the link we sent to{" "}
            <span className="font-medium text-foreground">{profile.email}</span>, then reload this
            page.
          </p>
          <ResendVerification email={profile.email} />
          <p className="text-xs text-muted-foreground">
            Wrong address? Sign out and create the account again, or ask an administrator to correct
            it.
          </p>
        </div>
      </main>
    </div>
  );
}
