import type { Metadata } from "next";

import { ProfileForm } from "@/components/settings/profile-form";
import { requireOrganization } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const { user, profile, organization } = await requireOrganization();

  return (
    <ProfileForm
      fullName={profile.full_name}
      email={profile.email}
      timezone={profile.timezone}
      language={profile.language}
      role={profile.role}
      verified={Boolean(user.email_confirmed_at)}
      organizationName={organization!.name}
    />
  );
}
