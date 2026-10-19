"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Definition affordance for server-rendered metric cards. The trigger is a real
 * button so keyboard and screen-reader users get the same explanation.
 */
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={text}
        >
          <Info className="size-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[280px] text-[11px] leading-4">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
