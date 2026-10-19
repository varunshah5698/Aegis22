import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  profile: Tables<"profiles">;
  organization: Tables<"organizations"> | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  let organization: Tables<"organizations"> | null = null;
  if (profile.organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization = data ?? null;
  }

  return { supabase, user, profile, organization };
});

export async function requireUser(nextPath = "/app/overview"): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return context;
}

export async function requireOrganization(nextPath = "/app/overview"): Promise<AuthContext> {
  const context = await requireUser(nextPath);
  if (!context.organization || !context.profile.organization_id) {
    redirect("/onboarding");
  }
  return context;
}

export async function requireRole(
  roles: Array<AuthContext["profile"]["role"]>,
): Promise<AuthContext> {
  const context = await requireOrganization();
  if (!roles.includes(context.profile.role)) {
    redirect("/app/overview?denied=1");
  }
  return context;
}

export function canManageTeam(role: AuthContext["profile"]["role"]): boolean {
  return role === "admin";
}

export function canInvestigate(role: AuthContext["profile"]["role"]): boolean {
  return role === "admin" || role === "analyst";
}

export function canPublishRules(role: AuthContext["profile"]["role"]): boolean {
  return role === "admin";
}

export function canManageApiKeys(role: AuthContext["profile"]["role"]): boolean {
  return role === "admin";
}
