"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export function LoginForm({ next, initialError }: { next: string; initialError?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState(initialError ?? "");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: { message: string } | null };
      if (!response.ok) {
        setFormError(payload.error?.message ?? "Sign-in failed. Check your details and try again.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your work account to reach the monitoring workspace.
        </p>
      </div>

      {formError ? (
        <div role="alert" className="rounded-card border border-risk-critical/30 bg-risk-critical/5 px-3 py-2 text-sm text-risk-critical">
          {formError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Work email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-xs text-risk-critical">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
          {errors.password ? (
            <p id="login-password-error" className="text-xs text-risk-critical">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="remember"
            render={({ field }) => (
              <Checkbox id="remember" checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} />
            )}
          />
          <Label htmlFor="remember" className="font-normal text-muted-foreground">
            Remember this device
          </Label>
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Continue with Google" next={next} />

      <p className="text-center text-sm text-muted-foreground">
        New to Aegis?{" "}
        <Link href="/signup" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4">
          Create an account
        </Link>
      </p>

      <div className="rounded-card border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo accounts</p>
        <p className="mt-1 num">admin@northwind.example · Sentinel-Demo-2026!</p>
        <p className="num">analyst1@northwind.example · Sentinel-Demo-2026!</p>
      </div>
    </div>
  );
}
