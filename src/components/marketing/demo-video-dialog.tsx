"use client";

import * as React from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";

export function DemoVideoDialog({ variant = "outline" }: { variant?: "outline" | "ghost" | "accent" }) {
  const hasVideo = siteConfig.demoVideoUrl.length > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size="lg">
          <Play aria-hidden="true" />
          Watch 2-minute demo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aegis in two minutes</DialogTitle>
          <DialogDescription>
            Ingest, score, explain and act on a cross-border payment — with the alert, the
            evidence and the case in one flow.
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-card border border-border bg-foreground/90">
          {hasVideo ? (
            <video
              className="h-full w-full"
              controls
              preload="metadata"
              src={siteConfig.demoVideoUrl}
              aria-label="Aegis product demo"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-background">
              <Play className="size-8" aria-hidden="true" />
              <p className="font-display text-lg font-semibold">Demo video placeholder</p>
              <p className="max-w-sm text-sm text-background/70">
                Set <code className="rounded bg-background/15 px-1.5 py-0.5 font-mono text-xs">demoVideoUrl</code> in
                the site config to embed the recorded walkthrough. In the meantime, the seeded
                demo environment shows the same flow end to end.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
