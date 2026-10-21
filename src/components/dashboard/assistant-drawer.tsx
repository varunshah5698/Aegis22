"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AnalystPanel } from "@/components/dashboard/analyst-panel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseRange } from "@/lib/data/common";

const pageKeys: Record<string, string> = {
  overview: "overview",
  analytics: "analytics",
  transactions: "transactions",
  network: "network",
  fx: "fx",
  corridors: "analytics",
  alerts: "overview",
  analyst: "default",
};

function pageFor(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[1] ?? "overview";
  return pageKeys[segment] ?? "default";
}

/**
 * One analyst, reachable from every page. The drawer persists its conversation
 * on this device (one history for the whole drawer, whatever page it is opened
 * from) and re-grounds each question on the window currently in the URL.
 */
export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const range = parseRange(params.get("range") ?? undefined);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("aegis:assistant", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("aegis:assistant", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-border/80 bg-card p-0 sm:max-w-[480px]">
        <SheetHeader className="space-y-1 border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-[7px] border border-accent/30 bg-accent/10">
              <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            </span>
            <SheetTitle className="font-display text-[15px] font-semibold">Aegis analyst</SheetTitle>
          </div>
          <SheetDescription className="text-[11.5px] leading-4 text-muted-foreground">
            Grounded on this workspace · {range} window · answers cite the figures they used
          </SheetDescription>
        </SheetHeader>
        <AnalystPanel
          range={range}
          page={pageFor(pathname)}
          surface="drawer"
          variant="bare"
          className="min-h-0 flex-1"
          scrollAreaClassName="max-h-[calc(100dvh-190px)]"
        />
      </SheetContent>
    </Sheet>
  );
}
