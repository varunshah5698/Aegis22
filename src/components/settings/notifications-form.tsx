"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateNotificationPrefs } from "@/app/(app)/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const TYPES = [
  { key: "alert_assigned", label: "Alert assigned to me", hint: "Someone hands you a new alert." },
  { key: "alert_escalated", label: "Alert escalated", hint: "Critical alerts move to escalation." },
  { key: "case_assigned", label: "Case assigned to me", hint: "You become the owner of an investigation." },
  { key: "case_mention", label: "Case mention", hint: "A teammate references you in a case note." },
  { key: "report_ready", label: "Report ready", hint: "A generated export finished rendering." },
  { key: "digest", label: "Daily digest", hint: "The morning summary of overnight activity." },
  { key: "system", label: "Workspace updates", hint: "Role changes, rule publishing and other admin events." },
] as const;

type Channel = "in_app" | "email";

export function NotificationsForm({ initial }: { initial: Record<Channel, Record<string, boolean>> }) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  const toggle = (channel: Channel, key: string, value: boolean) => {
    setPrefs((current) => ({ ...current, [channel]: { ...current[channel], [key]: value } }));
  };

  const save = async () => {
    setPending(true);
    const result = await updateNotificationPrefs(prefs);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="notification-heading" className="overflow-x-auto rounded-card border border-border bg-card">
        <h2 id="notification-heading" className="border-b border-border px-4 py-3 font-display text-sm font-semibold tracking-tight">
          Delivery channels
        </h2>
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Choose which events reach you in the app and by email.</caption>
          <thead className="border-b border-border bg-muted/40 text-[11.5px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Event</th>
              <th scope="col" className="px-4 py-2 text-center font-medium">In app</th>
              <th scope="col" className="px-4 py-2 text-center font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((type) => (
              <tr key={type.key} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block text-xs font-medium">{type.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{type.hint}</span>
                </th>
                {(["in_app", "email"] as const).map((channel) => (
                  <td key={channel} className="px-4 py-3">
                    <div className="flex justify-center">
                      <Switch
                        checked={prefs[channel]?.[type.key] ?? false}
                        onCheckedChange={(value) => toggle(channel, type.key, value)}
                        aria-label={`${type.label} ${channel === "in_app" ? "in app" : "by email"}`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPrefs(initial)} disabled={!dirty || pending}>
          Reset
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Email delivery requires a verified address. Critical alerts are always shown in the app.
        </p>
      </div>
    </div>
  );
}
