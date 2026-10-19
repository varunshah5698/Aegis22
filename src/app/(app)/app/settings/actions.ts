"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { canManageApiKeys, canManageTeam, requireOrganization } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

export interface SettingsResult {
  ok: boolean;
  message: string;
  apiKey?: string;
}

const TIMEZONE = /^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function audit(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as Json,
  });
}

export async function updateProfile(input: {
  fullName: string;
  timezone: string;
  language: string;
}): Promise<SettingsResult> {
  const { supabase, user, profile } = await requireOrganization();
  const fullName = input.fullName.trim();
  if (fullName.length < 1 || fullName.length > 120) return { ok: false, message: "Enter a name between 1 and 120 characters." };
  if (!TIMEZONE.test(input.timezone)) return { ok: false, message: "Choose a valid timezone." };
  if (!/^[a-z]{2}$/.test(input.language)) return { ok: false, message: "Choose a supported language." };

  const { error } = await supabase.rpc("update_own_profile", {
    p_full_name: fullName,
    p_timezone: input.timezone,
    p_language: input.language,
  });
  if (error) return { ok: false, message: error.message };

  if (profile.organization_id) {
    await audit(supabase, profile.organization_id, user.id, "profile.updated", "profile", user.id);
  }
  revalidatePath("/app/settings/profile");
  return { ok: true, message: "Profile saved." };
}

export async function updateNotificationPrefs(prefs: Record<string, Record<string, boolean>>): Promise<SettingsResult> {
  const { supabase, user, profile } = await requireOrganization();
  const allowed = ["in_app", "email"] as const;
  const cleaned: Record<string, Record<string, boolean>> = {};
  for (const channel of allowed) {
    const source = prefs[channel] ?? {};
    cleaned[channel] = Object.fromEntries(
      Object.entries(source)
        .filter(([key, value]) => typeof key === "string" && key.length < 40 && typeof value === "boolean")
        .map(([key, value]) => [key, value]),
    );
  }

  const { error } = await supabase.rpc("update_own_profile", {
    p_full_name: profile.full_name,
    p_timezone: profile.timezone,
    p_language: profile.language,
    p_notification_prefs: cleaned as Json,
  });
  if (error) return { ok: false, message: error.message };

  if (profile.organization_id) {
    await audit(supabase, profile.organization_id, user.id, "profile.notifications_updated", "profile", user.id);
  }
  revalidatePath("/app/settings/notifications");
  return { ok: true, message: "Notification preferences saved." };
}

export async function updateOrganization(input: {
  name: string;
  slug: string;
  timezone: string;
  baseCurrency: string;
  requireMfa: boolean;
}): Promise<SettingsResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canManageTeam(profile.role)) return { ok: false, message: "Only administrators can change organization settings." };

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const currency = input.baseCurrency.trim().toUpperCase();

  if (name.length < 2 || name.length > 120) return { ok: false, message: "Organization name must be 2–120 characters." };
  if (!SLUG.test(slug) || slug.length > 48) return { ok: false, message: "Use lowercase letters, numbers and single hyphens for the slug." };
  if (!TIMEZONE.test(input.timezone)) return { ok: false, message: "Choose a valid timezone." };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, message: "Base currency must be a three-letter code." };

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      slug,
      timezone: input.timezone,
      base_currency: currency,
      require_mfa: input.requireMfa,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organization.id);
  if (error) {
    return { ok: false, message: error.message.includes("duplicate") ? "That slug is already taken." : error.message };
  }

  await audit(supabase, organization.id, user.id, "organization.updated", "organization", organization.id, {
    slug,
    require_mfa: input.requireMfa,
  });
  revalidatePath("/app/settings/organization");
  revalidatePath("/app/overview");
  return { ok: true, message: "Organization settings saved." };
}

export async function updateMemberRole(memberId: string, role: "admin" | "analyst" | "viewer"): Promise<SettingsResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canManageTeam(profile.role)) return { ok: false, message: "Only administrators can change roles." };
  if (!["admin", "analyst", "viewer"].includes(role)) return { ok: false, message: "Unknown role." };

  const { data: member } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!member) return { ok: false, message: "Member not found." };
  if (member.role === role) return { ok: true, message: "Role unchanged." };

  if (member.role === "admin" && role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) return { ok: false, message: "Keep at least one administrator in the workspace." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  await supabase.from("notifications").insert({
    organization_id: organization.id,
    user_id: memberId,
    type: "system",
    title: "Your workspace role changed",
    body: `You are now a ${role} in ${organization.name}.`,
    link: "/app/settings/profile",
  });

  await audit(supabase, organization.id, user.id, "team.role_changed", "profile", memberId, {
    from: member.role,
    to: role,
  });
  revalidatePath("/app/settings/team");
  return { ok: true, message: "Role updated." };
}

export async function removeMember(memberId: string): Promise<SettingsResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canManageTeam(profile.role)) return { ok: false, message: "Only administrators can remove members." };
  if (memberId === user.id) return { ok: false, message: "You cannot remove yourself from the workspace." };

  const { data: member } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!member) return { ok: false, message: "Member not found." };

  const { error } = await supabase
    .from("profiles")
    .update({ organization_id: null, role: "viewer", updated_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, "team.member_removed", "profile", memberId, { email: member.email });
  revalidatePath("/app/settings/team");
  return { ok: true, message: `${member.email} no longer has access.` };
}

export async function createApiKey(input: { name: string; scopes: string[] }): Promise<SettingsResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canManageApiKeys(profile.role)) return { ok: false, message: "Only administrators can create API keys." };

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Key name must be 2–80 characters." };
  const allowed = ["score", "ingest", "read"];
  const scopes = [...new Set(input.scopes.filter((scope) => allowed.includes(scope)))];
  if (scopes.length === 0) return { ok: false, message: "Pick at least one scope." };

  const plaintext = `sf_live_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");

  const { error } = await supabase.from("api_keys").insert({
    organization_id: organization.id,
    name,
    prefix: plaintext.slice(0, 16),
    key_hash: hash,
    scopes,
    created_by: user.id,
  });
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, "api_key.created", "api_key", null, { name, scopes });
  revalidatePath("/app/settings/api-keys");
  return { ok: true, message: "API key created. Copy it now — it is never shown again.", apiKey: plaintext };
}

export async function revokeApiKey(keyId: string): Promise<SettingsResult> {
  const { supabase, user, profile, organization } = await requireOrganization();
  if (!organization) return { ok: false, message: "No organization." };
  if (!canManageApiKeys(profile.role)) return { ok: false, message: "Only administrators can revoke API keys." };

  const { data: key } = await supabase
    .from("api_keys")
    .select("id, name, revoked_at")
    .eq("id", keyId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!key) return { ok: false, message: "Key not found." };
  if (key.revoked_at) return { ok: true, message: "This key is already revoked." };

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("organization_id", organization.id);
  if (error) return { ok: false, message: error.message };

  await audit(supabase, organization.id, user.id, "api_key.revoked", "api_key", keyId, { name: key.name });
  revalidatePath("/app/settings/api-keys");
  return { ok: true, message: "Key revoked. Requests using it now fail." };
}
