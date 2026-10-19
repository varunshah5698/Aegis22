"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function ResendVerification({ email }: { email: string }) {
  const [cooldown, setCooldown] = React.useState(0);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setStatus("sending");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("sent");
      setMessage("Sent. Check your inbox and spam folder.");
      setCooldown(60);
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="accent" size="lg" className="w-full" onClick={resend} disabled={cooldown > 0 || status === "sending"}>
        {status === "sending"
          ? "Sending…"
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend verification email"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={status === "error" ? "text-sm text-risk-critical" : "text-sm text-muted-foreground"}
      >
        {message || `We will send it to ${email}.`}
      </p>
    </div>
  );
}
