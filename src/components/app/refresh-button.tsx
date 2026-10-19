"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

/** Re-renders the server page with fresh aggregates. */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className={cn(
        "flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
        className,
      )}
      aria-label="Refresh data"
      title="Refresh data"
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} aria-hidden="true" />
    </button>
  );
}
