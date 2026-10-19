"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { updateProfile } from "@/app/(app)/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { languages, timezones } from "@/config/site";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  fullName,
  email,
  timezone,
  language,
  role,
  verified,
  organizationName,
}: {
  fullName: string;
  email: string;
  timezone: string;
  language: string;
  role: string;
  verified: boolean;
  organizationName: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [tz, setTz] = React.useState(timezone);
  const [lang, setLang] = React.useState(language);
  const [pending, setPending] = React.useState(false);
  const [sendingReset, setSendingReset] = React.useState(false);
  const dirty = name !== fullName || tz !== timezone || lang !== language;

  const save = async () => {
    setPending(true);
    const result = await updateProfile({ fullName: name, timezone: tz, language: lang });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  const resetPassword = async () => {
    setSendingReset(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reset link sent to ${email}.`);
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="identity-heading" className="rounded-card border border-border bg-card p-4">
        <h2 id="identity-heading" className="font-display text-sm font-semibold tracking-tight">
          Identity
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="profile-name" className="text-xs">Full name</Label>
            <Input id="profile-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-email" className="text-xs">Email</Label>
            <Input id="profile-email" value={email} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timezone</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger aria-label="Timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Language</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger aria-label="Language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={pending || !dirty || name.trim().length === 0}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(fullName);
              setTz(timezone);
              setLang(language);
            }}
            disabled={!dirty || pending}
          >
            Reset
          </Button>
        </div>
      </section>

      <section aria-labelledby="access-heading" className="rounded-card border border-border bg-card p-4">
        <h2 id="access-heading" className="font-display text-sm font-semibold tracking-tight">
          Access
        </h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Workspace</dt>
            <dd>{organizationName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{role}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email status</dt>
            <dd>
              <Badge variant={verified ? "outline" : "high"} className="text-[10px]">
                {verified ? "Verified" : "Unverified"}
              </Badge>
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void resetPassword()} disabled={sendingReset}>
            <KeyRound aria-hidden="true" /> {sendingReset ? "Sending…" : "Send password reset"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Roles are managed by workspace administrators from the Team page.
          </p>
        </div>
      </section>
    </div>
  );
}
