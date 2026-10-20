import { SettingsNav } from "@/components/settings/settings-nav";
import { requireOrganization } from "@/lib/auth";
import { settingsNav } from "@/config/site";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOrganization();
  const items = settingsNav.filter(
    (item) => item.href !== "/app/settings/audit-log" || profile.role === "admin",
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5">
      <div className="border-b border-border pb-4">
        <p className="mb-1 text-[11.5px] font-medium text-muted-foreground">
          Workspace / Configuration
        </p>
        <h1 className="text-[21px] font-semibold leading-7 tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted-foreground">
          Your profile, the shared workspace configuration and the access trail behind both.
        </p>
      </div>
      <SettingsNav items={items.map((item) => ({ label: item.label, href: item.href }))} />
      {children}
    </div>
  );
}
