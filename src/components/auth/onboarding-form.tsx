"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timezones } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import { onboardingSchema, type OnboardingInput } from "@/lib/schemas/auth";
import { slugify } from "@/lib/utils";

export function OnboardingForm({
  defaultName,
  defaultOrganization,
  defaultTimezone,
}: {
  defaultName: string;
  defaultOrganization: string;
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"create" | "join">("create");
  const [formError, setFormError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: defaultName,
      timezone: defaultTimezone,
      mode: "create",
      organizationName: defaultOrganization,
      inviteToken: "",
    },
  });

  const timezone = watch("timezone");

  React.useEffect(() => {
    setValue("mode", mode);
  }, [mode, setValue]);

  const finish = () => {
    // The first screen of a new workspace is the one that can give it data.
    router.replace("/app/library?welcome=1");
    router.refresh();
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setFormError("");
    const supabase = createClient();

    try {
      // Persist display name and timezone first; both RPCs also update the profile.
      await supabase.rpc("update_own_profile", {
        p_full_name: values.fullName,
        p_timezone: values.timezone,
        p_language: "en",
      });

      if (values.mode === "join") {
        if (!values.inviteToken) {
          setFormError("Paste the invite token from your email.");
          return;
        }
        const { error } = await supabase.rpc("accept_invite", { p_token: values.inviteToken });
        if (error) {
          setFormError(error.message);
          return;
        }
        finish();
        return;
      }

      const name = (values.organizationName ?? "").trim();
      if (name.length < 2) {
        setFormError("Enter an organization name with at least two characters.");
        return;
      }

      const base = slugify(name) || "workspace";
      const attempt = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      let { error } = await supabase.rpc("create_organization", {
        p_name: name,
        p_slug: attempt,
        p_timezone: values.timezone,
        p_base_currency: "USD",
      });

      if (error?.code === "23505") {
        const retry = await supabase.rpc("create_organization", {
          p_name: name,
          p_slug: `${base}-${Math.random().toString(36).slice(2, 7)}`,
          p_timezone: values.timezone,
          p_base_currency: "USD",
        });
        error = retry.error;
      }

      if (error) {
        setFormError(error.message);
        return;
      }
      finish();
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Set up your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This decides which organization your access is scoped to. You can be invited to others
          later.
        </p>
      </div>

      <div role="tablist" aria-label="Organization setup" className="grid grid-cols-2 gap-2 rounded-pill bg-muted p-1">
        {(["create", "join"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "rounded-pill bg-card px-3 py-2 text-sm font-medium shadow-sm"
                : "rounded-pill px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {value === "create" ? "Create organization" : "Join with an invite"}
          </button>
        ))}
      </div>

      {formError ? (
        <div role="alert" className="rounded-card border border-risk-critical/30 bg-risk-critical/5 px-3 py-2 text-sm text-risk-critical">
          {formError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <input type="hidden" {...register("mode")} />
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-name">Display name</Label>
          <Input id="onboarding-name" autoComplete="name" {...register("fullName")} />
          {errors.fullName ? <p className="text-xs text-risk-critical">{errors.fullName.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboarding-timezone">Timezone</Label>
          <Select value={timezone} onValueChange={(value) => setValue("timezone", value)}>
            <SelectTrigger id="onboarding-timezone" aria-label="Timezone">
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Timestamps stay in UTC; this only changes how they are displayed.
          </p>
        </div>

        {mode === "create" ? (
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-organization">Organization name</Label>
            <Input
              id="onboarding-organization"
              autoComplete="organization"
              placeholder="Northwind Payments"
              {...register("organizationName")}
            />
            <p className="text-xs text-muted-foreground">
              You become the administrator. A unique slug is generated for your workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-invite">Invite token</Label>
            <Input id="onboarding-invite" autoComplete="off" placeholder="Paste the token from your invite email" {...register("inviteToken")} />
            <p className="text-xs text-muted-foreground">
              The token must match the email you signed up with and is single-use.
            </p>
          </div>
        )}

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Setting up…" : mode === "create" ? "Create workspace" : "Join workspace"}
        </Button>
        <p className="text-center text-[11px] leading-4 text-muted-foreground">
          Next: the data library, where you can generate a scored demo dataset in one click.
        </p>
      </form>
    </div>
  );
}
