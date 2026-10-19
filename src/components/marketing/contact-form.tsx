"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactRequestSchema, type ContactRequestInput } from "@/lib/schemas/contact";

const intents = [
  { value: "demo", label: "Book a demo" },
  { value: "sales", label: "Talk to sales" },
  { value: "support", label: "Product support" },
  { value: "other", label: "Something else" },
] as const;

export function ContactForm({ defaultIntent = "demo" }: { defaultIntent?: ContactRequestInput["intent"] }) {
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactRequestInput>({
    resolver: zodResolver(contactRequestSchema),
    defaultValues: { name: "", email: "", company: "", intent: defaultIntent, message: "", website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: { message: string } | null };
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error?.message ?? "We could not send your message. Please try again.");
        return;
      }
      setStatus("success");
      setMessage("Received. We reply within one business day.");
      reset({ name: "", email: "", company: "", intent: defaultIntent, message: "", website: "" });
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again, or email compliance@aegis.example.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Full name</Label>
          <Input
            id="contact-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id="contact-name-error" className="text-xs text-risk-critical">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Work email</Label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="contact-email-error" className="text-xs text-risk-critical">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-company">Company</Label>
          <Input id="contact-company" autoComplete="organization" {...register("company")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-intent">Reason for contact</Label>
          <select
            id="contact-intent"
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm focus-visible:border-foreground/40"
            {...register("intent")}
          >
            {intents.map((intent) => (
              <option key={intent.value} value={intent.value}>
                {intent.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">How can we help?</Label>
        <Textarea
          id="contact-message"
          rows={6}
          placeholder="Tell us about your corridors, volume and current monitoring setup."
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          {...register("message")}
        />
        {errors.message ? (
          <p id="contact-message-error" className="text-xs text-risk-critical">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send message"}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={
            status === "error"
              ? "text-sm text-risk-critical"
              : status === "success"
                ? "text-sm text-risk-low"
                : "text-xs text-muted-foreground"
          }
        >
          {message || "We never share your details with third parties."}
        </p>
      </div>
    </form>
  );
}
