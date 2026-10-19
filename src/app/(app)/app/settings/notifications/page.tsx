import type { Metadata } from "next";

import { NotificationsForm } from "@/components/settings/notifications-form";
import { requireOrganization } from "@/lib/auth";

export const metadata: Metadata = { title: "Notification settings" };

type Channel = "in_app" | "email";

const KEYS = [
  "alert_assigned",
  "alert_escalated",
  "case_assigned",
  "case_mention",
  "report_ready",
  "digest",
  "system",
] as const;

function normalise(value: unknown): Record<Channel, Record<string, boolean>> {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const pick = (channel: Channel) => {
    const channelValue = source[channel];
    const record = typeof channelValue === "object" && channelValue !== null ? (channelValue as Record<string, unknown>) : {};
    return Object.fromEntries(KEYS.map((key) => [key, record[key] === true]));
  };
  return { in_app: pick("in_app"), email: pick("email") };
}

export default async function NotificationSettingsPage() {
  const { profile } = await requireOrganization();
  return <NotificationsForm initial={normalise(profile.notification_prefs)} />;
}
