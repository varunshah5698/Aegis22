"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      // The response is intentionally ignored: the UI must not reveal whether the email exists.
      await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
    } catch {
      // Ignore network failures for the same reason.
    } finally {
      setSubmitting(false);
      setSent(true);
      setCooldown(60);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your work email. If an account exists, we send a link that expires in one hour.
        </p>
      </div>

      {sent ? (
        <div role="status" className="rounded-card border border-risk-low/30 bg-risk-low/10 px-3 py-3 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">
            We sent the instructions. If nothing arrives, check spam or wait a minute and try again.
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Work email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "forgot-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="forgot-email-error" className="text-xs text-risk-critical">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting || cooldown > 0}>
          {submitting
            ? "Sending…"
            : cooldown > 0
              ? `Sent · try again in ${cooldown}s`
              : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
