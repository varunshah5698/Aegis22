import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Aegis monitoring workspace.",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  callback_failed: "That sign-in link could not be verified. Request a new one and try again.",
  link_expired: "That link has expired. Request a new one and try again.",
  missing_code: "The sign-in link was incomplete. Start again from the login page.",
  session_expired: "Your session expired. Sign in again to continue.",
  oauth_failed: "Google sign-in could not be completed. Try again, or use your email and password.",
  oauth_cancelled: "Google sign-in was cancelled before it finished.",
  oauth_unavailable: "Google sign-in is not enabled for this deployment yet. Use your email and password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const initialError = params.error
    ? (errorMessages[params.error] ?? "Sign-in could not be completed. Try again.")
    : undefined;

  return <LoginForm next={next} initialError={initialError} />;
}
