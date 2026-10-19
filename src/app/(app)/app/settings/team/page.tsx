import type { Metadata } from "next";

import { TeamTable } from "@/components/settings/team-table";
import { canManageTeam, requireOrganization } from "@/lib/auth";
import { getTeamMembers } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Team settings" };

export default async function TeamSettingsPage() {
  const { supabase, user, profile, organization } = await requireOrganization();
  const members = await getTeamMembers(supabase, organization!.id);

  return (
    <TeamTable members={members} canEdit={canManageTeam(profile.role)} currentUserId={user.id} />
  );
}
