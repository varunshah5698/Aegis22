"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function SettingsNav({ items }: { items: Array<{ label: string; href: string }> }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="no-scrollbar -mx-1 flex gap-0.5 overflow-x-auto border-b border-border px-1 pb-0"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-[12px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-foreground" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
