import type { Metadata } from "next";

import { OrganizationForm } from "@/components/settings/organization-form";
import { canManageTeam, requireOrganization } from "@/lib/auth";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrganizationSettingsPage() {
  const { supabase, profile, organization } = await requireOrganization();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization!.id);

  return (
    <OrganizationForm
      name={organization!.name}
      slug={organization!.slug}
      timezone={organization!.timezone}
      baseCurrency={organization!.base_currency}
      requireMfa={organization!.require_mfa}
      plan={organization!.plan}
      memberCount={count ?? 0}
      canEdit={canManageTeam(profile.role)}
    />
  );
}
