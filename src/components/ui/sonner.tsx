"use client";

import { Toaster as SonnerToaster } from "sonner";

import { useTheme } from "@/components/theme-provider";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-border bg-card text-card-foreground shadow-lift",
          description: "text-muted-foreground",
          actionButton: "bg-foreground text-background",
        },
      }}
    />
  );
}
