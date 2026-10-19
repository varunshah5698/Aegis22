"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newsletterSchema, type NewsletterInput } from "@/lib/schemas/contact";

type Status = "idle" | "submitting" | "success" | "error";

export function NewsletterForm() {
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "", website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: { message: string } | null;
      };
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error?.message ?? "Subscription failed. Please try again.");
        return;
      }
      setStatus("success");
      setMessage("Subscribed. We send one short note a month, no more.");
      reset({ email: "", website: "" });
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <Label htmlFor="newsletter-email" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Monthly compliance brief
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "newsletter-error" : "newsletter-status"}
          className="bg-card"
          {...register("email")}
        />
        <Button type="submit" variant="accent" disabled={status === "submitting"}>
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="newsletter-website">Website</label>
        <input id="newsletter-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      {errors.email ? (
        <p id="newsletter-error" role="alert" className="text-xs text-risk-critical">
          {errors.email.message}
        </p>
      ) : null}
      <p
        id="newsletter-status"
        role="status"
        aria-live="polite"
        className={
          status === "error"
            ? "text-xs text-risk-critical"
            : status === "success"
              ? "text-xs text-risk-low"
              : "text-xs text-muted-foreground"
        }
      >
        {message || "No product spam. Unsubscribe in one click."}
      </p>
    </form>
  );
}
