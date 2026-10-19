"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { updateOrganization } from "@/app/(app)/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { timezones } from "@/config/site";

export function OrganizationForm({
  name: initialName,
  slug: initialSlug,
  timezone: initialTimezone,
  baseCurrency: initialCurrency,
  requireMfa: initialMfa,
  plan,
  memberCount,
  canEdit,
}: {
  name: string;
  slug: string;
  timezone: string;
  baseCurrency: string;
  requireMfa: boolean;
  plan: string;
  memberCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [slug, setSlug] = React.useState(initialSlug);
  const [tz, setTz] = React.useState(initialTimezone);
  const [currency, setCurrency] = React.useState(initialCurrency);
  const [requireMfa, setRequireMfa] = React.useState(initialMfa);
  const [pending, setPending] = React.useState(false);

  const dirty =
    name !== initialName ||
    slug !== initialSlug ||
    tz !== initialTimezone ||
    currency !== initialCurrency ||
    requireMfa !== initialMfa;

  const save = async () => {
    setPending(true);
    const result = await updateOrganization({ name, slug, timezone: tz, baseCurrency: currency, requireMfa });
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
      {!canEdit ? (
        <p className="rounded-card border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Only administrators can change workspace settings. Ask an admin if something needs to move.
        </p>
      ) : null}

      <section aria-labelledby="org-heading" className="rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="org-heading" className="font-display text-sm font-semibold tracking-tight">
            Workspace
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">{plan} plan</Badge>
            <Badge variant="outline" className="text-[10px]">{memberCount} members</Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="org-name" className="text-xs">Name</Label>
            <Input id="org-name" value={name} maxLength={120} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-slug" className="text-xs">Slug</Label>
            <Input
              id="org-slug"
              value={slug}
              maxLength={48}
              disabled={!canEdit}
              onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            />
            <p className="text-[11px] text-muted-foreground">Used in API paths and exports.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timezone</Label>
            <Select value={tz} onValueChange={setTz} disabled={!canEdit}>
              <SelectTrigger aria-label="Workspace timezone">
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
            <p className="text-[11px] text-muted-foreground">SLA clocks and digests follow this zone. Records stay in UTC.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-currency" className="text-xs">Base currency</Label>
            <Input
              id="org-currency"
              value={currency}
              maxLength={3}
              disabled={!canEdit}
              onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            />
            <p className="text-[11px] text-muted-foreground">Totals are converted to this code, USD by default.</p>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-1">
            <Label htmlFor="org-mfa" className="flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Require multi-factor authentication
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Members without a second factor are prompted at their next sign-in. Recommended for production workspaces.
            </p>
          </div>
          <Switch id="org-mfa" checked={requireMfa} disabled={!canEdit} onCheckedChange={setRequireMfa} />
        </div>

        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void save()} disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!dirty || pending}
              onClick={() => {
                setName(initialName);
                setSlug(initialSlug);
                setTz(initialTimezone);
                setCurrency(initialCurrency);
                setRequireMfa(initialMfa);
              }}
            >
              Reset
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
