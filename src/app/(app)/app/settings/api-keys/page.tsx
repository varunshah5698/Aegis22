import type { Metadata } from "next";

import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { canManageApiKeys, requireOrganization } from "@/lib/auth";
import { getApiKeys } from "@/lib/data/settings";

export const metadata: Metadata = { title: "API keys" };

export default async function ApiKeysSettingsPage() {
  const { supabase, profile, organization } = await requireOrganization();
  const keys = await getApiKeys(supabase, organization!.id);

  return <ApiKeysPanel keys={keys} canManage={canManageApiKeys(profile.role)} />;
}
