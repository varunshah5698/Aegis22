import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Aegis monitoring workspace.",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  callback_failed:
    "Your email is confirmed, but the link was opened somewhere other than the browser where you signed up, so it could not finish the handoff. Sign in once below and you will continue straight into setup — no second confirmation needed. If the link is stale, request a new one from the verification page.",
  link_expired: "That confirmation link has expired. Request a new one from the verification page and open it in the same browser.",
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
