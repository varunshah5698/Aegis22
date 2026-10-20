"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { passwordStrength, signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

export function SignupForm({ inviteToken }: { inviteToken?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [checkEmail, setCheckEmail] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      organizationName: "",
      acceptTerms: false as unknown as true,
    },
  });

  const password = useWatch({ control, name: "password" });
  const strength = passwordStrength(password ?? "");

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            organization_name: values.organizationName || "",
            ...(inviteToken ? { invite_token: inviteToken } : {}),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      if (error) {
        setFormError(
          error.message.toLowerCase().includes("already")
            ? "An account with that email already exists. Sign in or reset your password."
            : error.message,
        );
        return;
      }

      if (data.session) {
        router.replace(inviteToken ? "/app/library" : "/onboarding");
        router.refresh();
        return;
      }
      setCheckEmail(true);
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  });

  if (checkEmail) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent">
          <CheckCircle2 className="size-6 text-accent-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-display-md">Check your inbox</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          We sent a confirmation link. Open it to finish setting up your workspace. If it does not
          arrive within a minute, check spam or request another from the verification page.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {inviteToken
            ? "Finish joining your team's workspace. Your role is set by the invitation."
            : "Start with the reference dataset, then connect your own transaction feed."}
        </p>
      </div>

      {formError ? (
        <div role="alert" className="rounded-card border border-risk-critical/30 bg-risk-critical/5 px-3 py-2 text-sm text-risk-critical">
          {formError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input
            id="signup-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "signup-name-error" : undefined}
            {...register("fullName")}
          />
          {errors.fullName ? (
            <p id="signup-name-error" className="text-xs text-risk-critical">
              {errors.fullName.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Work email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="signup-email-error" className="text-xs text-risk-critical">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby="signup-password-help"
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
          <Progress
            value={(strength.score / 4) * 100}
            className="h-1.5"
            indicatorClassName={cn(
              strength.score <= 1 && "bg-risk-critical",
              strength.score === 2 && "bg-risk-medium",
              strength.score === 3 && "bg-risk-low",
              strength.score === 4 && "bg-risk-low",
            )}
            aria-label={`Password strength: ${strength.label}`}
          />
          <p id="signup-password-help" className="text-xs text-muted-foreground">
            At least 12 characters, one number and one symbol. Strength: {strength.label}.
          </p>
          {errors.password ? (
            <p className="text-xs text-risk-critical">{errors.password.message}</p>
          ) : null}
        </div>

        {inviteToken ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="signup-organization">Organization name (optional)</Label>
            <Input
              id="signup-organization"
              autoComplete="organization"
              placeholder="Northwind Payments"
              {...register("organizationName")}
            />
            <p className="text-xs text-muted-foreground">
              You can create the organization during onboarding instead.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="accept-terms"
                className="mt-0.5"
                checked={field.value === true}
                onCheckedChange={(value) => field.onChange(value === true)}
                aria-describedby="accept-terms-error"
              />
            )}
          />
          <div>
            <Label htmlFor="accept-terms" className="font-normal leading-5 text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" className="underline decoration-accent decoration-2 underline-offset-4">
                terms of service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline decoration-accent decoration-2 underline-offset-4">
                privacy policy
              </Link>
              .
            </Label>
            {errors.acceptTerms ? (
              <p id="accept-terms-error" className="mt-1 text-xs text-risk-critical">
                {errors.acceptTerms.message}
              </p>
            ) : null}
          </div>
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Sign up with Google" next="/onboarding" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
