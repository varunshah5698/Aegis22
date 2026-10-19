import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Start monitoring cross-border payments with Aegis.",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const inviteToken = typeof params.invite === "string" && params.invite.length <= 200 ? params.invite : undefined;

  return <SignupForm inviteToken={inviteToken} />;
}
