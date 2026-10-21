"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CircleStop, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";

import { ChatHistoryMenu, NewChatButton } from "@/components/dashboard/chat-history-menu";
import { useChatHistory, type AssistantReply, type ChatTurn } from "@/lib/ai/chat-history";
import type { RangeKey } from "@/lib/data/common";
import { cn, formatCompactNumber } from "@/lib/utils";

/**
 * Grounded analyst surface.
 *
 * The browser never talks to the model provider: it posts a question to
 * /api/assistant, which resolves the workspace, reads the numbers for the
 * selected window and only then asks the model. The evidence footer makes the
 * grounding visible so an answer can be checked against the dashboard.
 */

// Shared with the console and re-exported for existing importers (the
// insight surfaces); one definition keeps saved history decodable everywhere.
export type { AssistantReply } from "@/lib/ai/chat-history";
type Turn = ChatTurn;

const SUGGESTIONS: Record<string, string[]> = {
  overview: [
    "What changed in this window and why does it matter?",
    "Which corridor carries the most risk for its size?",
    "Summarise the open alert backlog in three points.",
  ],
  analytics: [
    "Explain the score distribution against the alert cutoff.",
    "Where is volume concentrating, and is that concentration risky?",
    "Which signal is driving most of the flagged volume?",
  ],
  fx: [
    "How does currency exposure interact with the flagged volume?",
    "Which traded currencies lack a reference rate, and what does that block?",
    "Explain the difference between a published fixing and a live quote.",
  ],
  transactions: [
    "Which counterparties concentrate the most screened value?",
    "What do the risky rows in this window have in common?",
    "Summarise the corridors behind the largest payments.",
  ],
  network: [
    "Which entities look like pass-through intermediaries, and why?",
    "Explain the relationship between the flagged entities.",
    "What should I open first in this network?",
  ],
  analyst: [
    "Brief me on this workspace in under 200 words.",
    "What would you investigate first, and why?",
    "Explain the largest deviation in this window.",
    "Which corridors and payers deserve a closer look?",
  ],
  default: [
    "What should I look at first in this workspace?",
    "Which payers stand out against their peers?",
    "Give me a two-minute briefing for a shift handover.",
  ],
};

function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="num rounded bg-muted px-1 py-0.5 text-[11.5px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={index}>{part}</span>;
    });
}

export function AnswerBody({ text }: { text: string }) {
  const blocks: Array<{ kind: "p" | "ul" | "ol"; lines: string[] }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim().length === 0) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const kind = bullet ? "ul" : numbered ? "ol" : "p";
    const content = bullet?.[1] ?? numbered?.[1] ?? line;
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind && kind !== "p") last.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }

  return (
    <div className="space-y-2.5 text-[12.5px] leading-[1.65] text-foreground/90">
      {blocks.map((block, index) => {
        if (block.kind === "p") return <p key={index}>{inline(block.lines.join(" "))}</p>;
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={index} className={cn("space-y-1.5 pl-4", block.kind === "ul" ? "list-disc" : "list-decimal")}>
            {block.lines.map((line, lineIndex) => (
              <li key={lineIndex} className="marker:text-muted-foreground">
                {inline(line)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

export function EvidenceFooter({ reply }: { reply: AssistantReply }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
      <span className="num">
        window {reply.evidence.window} · {reply.evidence.from} → {reply.evidence.to}
      </span>
      <span aria-hidden="true">·</span>
      <span className="num">{reply.evidence.payments.toLocaleString("en-US")} payments</span>
      <span aria-hidden="true">·</span>
      <span className="num">${formatCompactNumber(reply.evidence.valueUsd)} screened</span>
      <span aria-hidden="true">·</span>
      <span className="num">
        {reply.evidence.flagged} flagged (score ≥ {reply.evidence.alertCutoff})
      </span>
      <span className="num ml-auto opacity-70">{reply.model}</span>
    </div>
  );
}

export function AnalystPanel({
  range,
  page = "overview",
  variant = "card",
  surface,
  scope = "default",
  className,
  scrollAreaClassName,
}: {
  range: RangeKey;
  page?: string;
  variant?: "card" | "bare";
  /** Storage key for saved chats; defaults to the page it is rendered on. */
  surface?: string;
  /** Workspace id — separates this browser's saved chats per tenant. */
  scope?: string;
  className?: string;
  scrollAreaClassName?: string;
}) {
  const [question, setQuestion] = useState("");
  const history = useChatHistory({ surface: surface ?? `panel:${page}`, scope });
  const { turns, setTurns } = history;
  const [pending, setPending] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const suggestions = SUGGESTIONS[page] ?? SUGGESTIONS.default!;

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [turns]);

  async function ask(next?: string) {
    const text = (next ?? question).trim();
    if (text.length < 4 || pending) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    // Captured before the new turn is appended: this is the memory the model
    // receives so a follow-up lands with the earlier exchange in context.
    const priorTurns = history.promptHistory();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTurns((current) => [...current, { id, question: text, reply: null, error: null, pending: true }]);
    setPending(true);
    setQuestion("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, range, page, history: priorTurns }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        data: AssistantReply | null;
        error: { message: string } | null;
      };
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? !payload.data
              ? {
                  ...turn,
                  pending: false,
                  error: payload.error?.message ?? "The analyst did not answer. Try again.",
                }
              : { ...turn, pending: false, reply: payload.data }
            : turn,
        ),
      );
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id
              ? { ...turn, pending: false, error: "The request did not complete. Check the connection and try again." }
              : turn,
          ),
        );
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function stop() {
    abort.current?.abort();
    setPending(false);
    setTurns((current) => current.map((turn) => (turn.pending ? { ...turn, pending: false, error: "Stopped." } : turn)));
  }

  function retry(turn: Turn) {
    void ask(turn.question);
  }

  const lastTurn = turns[turns.length - 1];

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        variant === "card" && "rounded-panel border border-border bg-card",
        variant === "card" &&
          "bg-[linear-gradient(180deg,rgb(120_156_214/0.055),transparent_170px)] shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]",
        className,
      )}
    >
      {variant === "card" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            <h2 className="text-[13px] font-medium">Ask the analyst</h2>
          </div>
          <span className="chip border-accent/30 bg-accent/10 text-[11px] text-accent">
            grounded on this workspace · window-scoped
          </span>
        </div>
      ) : null}

      <div className={cn("flex min-h-0 flex-1 flex-col px-5 py-4")}>
        {history.ready ? (
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">
              {turns[0]?.question.slice(0, 48) ?? "New conversation"}
              {turns.length > 0 ? <span className="num"> · {turns.length} turns</span> : null}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <ChatHistoryMenu
                sessions={history.sessions}
                activeId={history.activeId}
                onOpen={history.open}
                onRemove={history.remove}
                onNew={history.newChat}
              />
              <NewChatButton onClick={history.newChat} />
            </div>
          </div>
        ) : null}

        <div ref={scroller} className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto", scrollAreaClassName)}>
          {turns.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[12px] leading-5 text-muted-foreground">
                Ask about corridors, signals, exposure or the queue. Answers use only the aggregates this workspace has
                computed for the selected window — the window and figures are printed under every reply.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {turns.map((turn, index) => (
            <article key={turn.id} className="space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[8.5px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <p className="text-[12.5px] font-medium leading-5 text-foreground">{turn.question}</p>
              </div>

              {turn.pending ? (
                <div className="ml-6 space-y-2" role="status">
                  <span className="sr-only">Reading the workspace numbers</span>
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
                </div>
              ) : null}

              {turn.reply ? (
                <div className="ml-6 rounded-tile border border-border/60 bg-background/40 px-3.5 py-3">
                  <AnswerBody text={turn.reply.answer} />
                  <EvidenceFooter reply={turn.reply} />
                </div>
              ) : null}

              {turn.error ? (
                <div className="ml-6 flex items-start gap-2 rounded-tile border border-risk-high/30 bg-risk-high/10 px-3 py-2.5 text-[12px] text-risk-high">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{turn.error}</span>
                  {turn.error === "Stopped." ? null : (
                    <button
                      type="button"
                      onClick={() => retry(turn)}
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1 text-[11px] font-medium underline-offset-2 hover:underline"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Retry
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form
          className="mt-3 flex shrink-0 items-end gap-2 border-t border-border/50 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor={`analyst-question-${page}`}>
            Ask a question about this workspace
          </label>
          <textarea
            id={`analyst-question-${page}`}
            value={question}
            rows={1}
            maxLength={500}
            placeholder={lastTurn ? "Ask a follow-up…" : "Ask about this window — corridors, signals, backlog, concentration…"}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
            className="min-h-[38px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-[12.5px] leading-5 outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {pending ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-[38px] items-center gap-1.5 rounded-md border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <CircleStop className="size-3.5" aria-hidden="true" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={question.trim().length < 4}
              className="flex h-[38px] items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ask
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
