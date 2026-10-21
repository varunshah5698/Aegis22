"use client";

import * as React from "react";
import { MessageSquarePlus, History, Trash2, X } from "lucide-react";

import type { ChatSession } from "@/lib/ai/chat-history";
import { cn } from "@/lib/utils";

function relativeTime(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(at));
}

export type HistoryTone = "card" | "stage";

/**
 * The conversation list itself — used inline in the console session rail and
 * inside the panel's dropdown. One implementation so both surfaces order,
 * label and delete sessions the same way.
 */
export function ChatHistoryList({
  sessions,
  activeId,
  onOpen,
  onRemove,
  tone = "card",
  emptyHint,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  tone?: HistoryTone;
  emptyHint?: string;
}) {
  if (sessions.length === 0) {
    return (
      <p className={cn("px-1 py-2 text-[11px] leading-4", tone === "stage" ? "text-white/45" : "text-muted-foreground")}>
        {emptyHint ?? "No saved conversations yet. Your chats are kept on this device."}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {sessions.map((session) => {
        const active = session.id === activeId;
        return (
          <li key={session.id}>
            <div
              className={cn(
                "group/item flex items-stretch gap-1 rounded-[9px] border transition-colors",
                tone === "stage"
                  ? cn(
                      "border-white/8 bg-white/[0.03]",
                      active
                        ? "border-[#2DD4BF]/45 bg-[#2DD4BF]/8"
                        : "hover:border-white/20 hover:bg-white/[0.06]",
                    )
                  : cn(
                      "border-border/60 bg-background/40",
                      active ? "border-accent/50 bg-accent/5" : "hover:border-border-strong hover:bg-muted/40",
                    ),
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
                title={session.title}
              >
                <p
                  className={cn(
                    "truncate text-[11.5px] font-medium leading-4",
                    tone === "stage" ? cn("text-white/85", !active && "text-white/70") : cn("text-foreground", !active && "text-foreground/80"),
                  )}
                >
                  {session.title}
                </p>
                <p
                  className={cn(
                    "num mt-0.5 flex items-center gap-1.5 text-[11px]",
                    tone === "stage" ? "text-white/40" : "text-muted-foreground",
                  )}
                >
                  <span>{relativeTime(session.updatedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {session.turns.length} {session.turns.length === 1 ? "turn" : "turns"}
                  </span>
                </p>
              </button>
              <button
                type="button"
                onClick={() => onRemove(session.id)}
                aria-label={`Delete conversation: ${session.title}`}
                className={cn(
                  "group/delete flex w-7 shrink-0 items-center justify-center rounded-r-[9px] opacity-0 transition-opacity focus-visible:opacity-100 group-hover/item:opacity-100",
                  tone === "stage"
                    ? "text-white/40 hover:bg-[#F45E5E]/15 hover:text-[#FFB4AE]"
                    : "text-muted-foreground hover:bg-risk-critical/10 hover:text-risk-critical",
                )}
              >
                <Trash2 className="size-3" aria-hidden="true" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** New-conversation button, styled for the surface it sits on. */
export function NewChatButton({
  onClick,
  tone = "card",
  compact,
}: {
  onClick: () => void;
  tone?: HistoryTone;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] font-medium transition-colors",
        tone === "stage"
          ? "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white"
          : "border-border bg-muted/30 text-muted-foreground hover:border-border-strong hover:text-foreground",
        compact && "px-1.5",
      )}
      title="Start a new conversation"
    >
      <MessageSquarePlus className="size-3" aria-hidden="true" />
      New chat
    </button>
  );
}

/**
 * Dropdown wrapper for the analyst panel: a trigger showing how many saved
 * conversations exist, and the list beneath it. Closes on outside click and
 * Escape, like a menu should.
 */
export function ChatHistoryMenu({
  sessions,
  activeId,
  onOpen,
  onRemove,
  onNew,
  tone = "card",
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onNew: () => void;
  tone?: HistoryTone;
}) {
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] font-medium transition-colors",
          tone === "stage"
            ? "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white"
            : "border-border bg-muted/30 text-muted-foreground hover:border-border-strong hover:text-foreground",
        )}
      >
        <History className="size-3" aria-hidden="true" />
        History
        {sessions.length > 0 ? (
          <span className={cn("num text-[11px]", tone === "stage" ? "text-white/45" : "text-muted-foreground")}>
            {sessions.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+6px)] z-50 w-[290px] rounded-[12px] border p-2 shadow-xl",
            tone === "stage" ? "border-white/12 bg-[#0E1522]" : "border-border bg-card",
          )}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", tone === "stage" ? "text-white/45" : "text-muted-foreground")}>
              Conversations
            </p>
            <div className="flex items-center gap-1.5">
              <NewChatButton
                tone={tone}
                compact
                onClick={() => {
                  onNew();
                  setOpen(false);
                }}
              />
              <button
                type="button"
                aria-label="Close history"
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded p-1",
                  tone === "stage" ? "text-white/45 hover:text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>
          <ChatHistoryList
            sessions={sessions}
            activeId={activeId}
            onOpen={(id) => {
              onOpen(id);
              setOpen(false);
            }}
            onRemove={onRemove}
            tone={tone}
            emptyHint="No saved conversations yet."
          />
        </div>
      ) : null}
    </div>
  );
}
