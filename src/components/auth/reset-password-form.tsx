"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { passwordStrength, resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const strength = passwordStrength(watch("password") ?? "");

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        setFormError(
          error.message.toLowerCase().includes("same")
            ? "Choose a password you have not used before."
            : error.message,
        );
        return;
      }
      // End every other session so a stolen token cannot keep access.
      await supabase.auth.signOut({ scope: "others" });
      setDone(true);
      window.setTimeout(() => {
        router.replace("/app/library");
        router.refresh();
      }, 1200);
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  });

  if (hasSession === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-display-md">This reset link has expired</h1>
        <p className="text-sm text-muted-foreground">
          Recovery links are single-use and expire after one hour. Request a fresh one.
        </p>
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="space-y-3">
        <h1 className="text-display-md">Password updated</h1>
        <p className="text-sm text-muted-foreground">
          Other sessions were signed out. Taking you to the workspace…
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/app/library">Continue now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          At least 12 characters with a number and a symbol. Signing out other sessions keeps a
          stolen token from surviving the reset.
        </p>
      </div>

      {formError ? (
        <div role="alert" className="rounded-card border border-risk-critical/30 bg-risk-critical/5 px-3 py-2 text-sm text-risk-critical">
          {formError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="reset-password-help"
            {...register("password")}
          />
          <Progress
            value={(strength.score / 4) * 100}
            className="h-1.5"
            indicatorClassName={strength.score <= 1 ? "bg-risk-critical" : strength.score === 2 ? "bg-risk-medium" : "bg-risk-low"}
            aria-label={`Password strength: ${strength.label}`}
          />
          <p id="reset-password-help" className="text-xs text-muted-foreground">
            Strength: {strength.label}.
          </p>
          {errors.password ? <p className="text-xs text-risk-critical">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)}
            {...register("confirm")}
          />
          {errors.confirm ? <p className="text-xs text-risk-critical">{errors.confirm.message}</p> : null}
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting || hasSession !== true}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
