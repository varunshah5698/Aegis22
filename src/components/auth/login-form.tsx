"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2, ShieldCheck, Terminal } from "lucide-react";

import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@northwind.example" },
  { role: "Analyst", email: "analyst1@northwind.example" },
];
const DEMO_PASSWORD = "Sentinel-Demo-2026!";

const fieldClass =
  "h-11 rounded-lg border-border bg-muted/40 px-3.5 text-[15px] transition-[border-color,background-color,box-shadow] focus-visible:border-accent/70 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-accent/20";

export function LoginForm({ next, initialError }: { next: string; initialError?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState(initialError ?? "");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  /** Demo affordance: fills the form instead of submitting, so it stays reviewable. */
  const useDemoAccount = () => {
    setFormError("");
    setValue("email", DEMO_ACCOUNTS[0]!.email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
  };

  return (
    <div>
      <p className="inline-flex items-center gap-2 rounded-pill border border-border bg-muted/50 py-1 pl-1 pr-3 text-[11px] font-medium tracking-[0.02em] text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent/15 text-accent">
          <ShieldCheck className="size-3" aria-hidden="true" />
        </span>
        Secure workspace access
      </p>

      <h1 className="mt-5 font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em]">
        Sign in
      </h1>
      <p className="mt-2.5 max-w-[38ch] text-[14.5px] leading-6 text-muted-foreground">
        Welcome back. Every payment in your workspace is already scored and waiting.
      </p>

      {formError ? (
        <div
          role="alert"
          className="mt-5 flex gap-2.5 rounded-lg border border-risk-critical/30 bg-risk-critical/[0.07] px-3.5 py-3 text-[13px] leading-5 text-risk-critical"
        >
          <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-[12.5px] font-medium text-foreground">
            Email
          </Label>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            spellCheck={false}
            placeholder="you@company.com"
            className={fieldClass}
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

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="login-password" className="text-[12.5px] font-medium text-foreground">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className={`${fieldClass} pr-11`}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p id="login-password-error" className="text-xs text-risk-critical">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <Controller
            control={control}
            name="remember"
            render={({ field }) => (
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
              />
            )}
          />
          <Label htmlFor="remember" className="text-[13px] font-normal text-muted-foreground">
            Keep me signed in on this device
          </Label>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="group h-11 w-full rounded-lg text-[14.5px] font-semibold shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_10px_24px_-14px_rgb(240_160_64/0.9)]"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight
                className="transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </form>

      <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-5">
        <GoogleButton label="Continue with Google" next={next} />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
        Don&apos;t have a workspace?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 transition-colors hover:text-accent"
        >
          Create one
        </Link>
      </p>

      <div className="mt-7 border-t border-dashed border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            <Terminal className="size-3.5" aria-hidden="true" />
            Review access
          </p>
          <button
            type="button"
            onClick={useDemoAccount}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Use admin demo
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-[12px] sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.email} className="bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                {account.role}
              </p>
              <p className="num mt-0.5 truncate text-foreground/90">{account.email}</p>
            </div>
          ))}
          <div className="bg-muted/30 px-3 py-2 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
              Password
            </p>
            <p className="num mt-0.5 text-foreground/90">{DEMO_PASSWORD}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
