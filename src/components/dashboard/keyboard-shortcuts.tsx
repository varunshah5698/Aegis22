"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const shortcuts = [
  { keys: "g o", label: "Go to overview" },
  { keys: "g y", label: "Go to analytics" },
  { keys: "g t", label: "Go to transactions" },
  { keys: "g c", label: "Go to corridors" },
  { keys: "g f", label: "Go to FX intelligence" },
  { keys: "g a", label: "Go to alerts" },
  { keys: "g n", label: "Go to network" },
  { keys: "g k", label: "Go to cases" },
  { keys: "g i", label: "Go to the AI analyst" },
  { keys: "g d", label: "Go to the data library" },
  { keys: "g r", label: "Go to rules" },
  { keys: "?", label: "Show this help" },
  { keys: "⌘K", label: "Search the workspace" },
  { keys: "⌘J", label: "Open the Aegis analyst" },
];

const destination: Record<string, string> = {
  o: "/app/overview",
  y: "/app/analytics",
  t: "/app/transactions",
  c: "/app/corridors",
  f: "/app/fx",
  a: "/app/alerts",
  n: "/app/network",
  k: "/app/cases",
  i: "/app/analyst",
  d: "/app/library",
  r: "/app/rules",
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<string | null>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (pending.current === "g") {
        const path = destination[event.key.toLowerCase()];
        pending.current = null;
        if (path) {
          event.preventDefault();
          router.push(path);
        }
        return;
      }
      if (event.key.toLowerCase() === "g") {
        pending.current = "g";
        window.setTimeout(() => {
          pending.current = null;
        }, 1200);
      }
    };

    const onShow = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("sf:shortcuts", onShow);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("sf:shortcuts", onShow);
    };
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are disabled while you are typing in a field.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between py-2.5">
              <dt className="text-sm">{shortcut.label}</dt>
              <dd>
                <kbd className="num rounded border border-border bg-muted px-2 py-0.5 text-xs">{shortcut.keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
