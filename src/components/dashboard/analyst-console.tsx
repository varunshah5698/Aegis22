"use client";

import * as React from "react";
import { ArrowUp, CircleStop, History, Mic, RotateCcw, ShieldCheck, Sparkles, TriangleAlert, Waves } from "lucide-react";

import { ChatHistoryList, NewChatButton } from "@/components/dashboard/chat-history-menu";
import { useChatHistory, type AssistantReply } from "@/lib/ai/chat-history";
import type { RangeKey } from "@/lib/data/common";
import { cn, formatCompactNumber } from "@/lib/utils";

/**
 * Analyst console.
 *
 * The browser never talks to the model provider: it posts a question to
 * /api/assistant, which resolves the workspace, reads the numbers for the
 * selected window and only then asks the model. The evidence rail repeats those
 * same figures so an answer can be checked without leaving the room.
 */

export interface ConsoleEvidence {
  windowLabel: string;
  from: string;
  to: string;
  payments: number;
  valueUsd: number;
  flagged: number;
  avgScore: number;
  cutoff: number;
  modelVersion: string;
  configured: boolean;
  corridors: Array<{ corridor: string; count: number; value: number; flagged: number }>;
  signals: Array<{ label: string; count: number }>;
}

const STARTERS = [
  "Brief me on this window in under 200 words.",
  "Which corridor carries the most risk for its size?",
  "What would you investigate first, and why?",
  "Where is value concentrating that should not be?",
];

/* ------------------------------------------------------------------ speech */

type SpeechEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/* ------------------------------------------------------------------ inline */

function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="num rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/85">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={index}>{part}</span>;
    });
}

function AnswerBody({ text }: { text: string }) {
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
    <div className="space-y-2.5 text-[13px] leading-[1.7] text-white/78">
      {blocks.map((block, index) => {
        if (block.kind === "p") return <p key={index}>{inline(block.lines.join(" "))}</p>;
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={index} className={cn("space-y-1.5 pl-4", block.kind === "ul" ? "list-disc" : "list-decimal")}>
            {block.lines.map((line, lineIndex) => (
              <li key={lineIndex} className="marker:text-white/35">
                {inline(line)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- console */

export function AnalystConsole({
  range,
  evidence,
  scope = "default",
}: {
  range: RangeKey;
  evidence: ConsoleEvidence;
  /** Workspace id — separates this browser's saved chats per tenant. */
  scope?: string;
}) {
  const [question, setQuestion] = React.useState("");
  const history = useChatHistory({ surface: "console", scope });
  const { turns, setTurns } = history;
  const [pending, setPending] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [voiceNote, setVoiceNote] = React.useState("");
  const abort = React.useRef<AbortController | null>(null);
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const recognition = React.useRef<Recognition | null>(null);

  React.useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [turns]);

  React.useEffect(() => () => recognition.current?.stop(), []);

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
        body: JSON.stringify({ question: text, range, page: "analyst", history: priorTurns }),
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
              ? { ...turn, pending: false, error: payload.error?.message ?? "The analyst did not answer. Try again." }
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

  function toggleVoice() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setVoiceNote("Voice capture is unavailable in this browser. Type the question instead.");
      return;
    }
    setVoiceNote("");
    try {
      const instance = new Ctor();
      instance.continuous = false;
      instance.interimResults = true;
      instance.lang = "en-US";
      instance.onresult = (event) => {
        let transcript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index]?.[0]?.transcript ?? "";
        }
        if (transcript.trim()) setQuestion(transcript.trim().slice(0, 500));
      };
      instance.onerror = () => {
        setListening(false);
        setVoiceNote("The microphone is blocked for this deployment. Type the question instead.");
      };
      instance.onend = () => setListening(false);
      instance.start();
      recognition.current = instance;
      setListening(true);
    } catch {
      setListening(false);
      setVoiceNote("The microphone is blocked for this deployment. Type the question instead.");
    }
  }

  const corridors = evidence.corridors.slice(0, 4);
  const maxCorridor = Math.max(1, ...corridors.map((corridor) => corridor.value));

  return (
    <section className="stage" aria-label="AI analyst console">
      <div className="stage-rules pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="orbit left-1/2 top-[-38%] h-[660px] w-[660px] -translate-x-1/2" aria-hidden="true" />
      <div className="orbit left-1/2 top-[-30%] h-[520px] w-[520px] -translate-x-1/2 opacity-70" aria-hidden="true" />
      <div className="orbit right-[-18%] bottom-[-24%] h-[420px] w-[420px]" aria-hidden="true" />

      <div className="relative grid gap-3 p-3 sm:p-4 xl:grid-cols-[248px_minmax(0,1fr)_264px] xl:gap-4 xl:p-5">
        {/* Session rail -------------------------------------------------- */}
        <aside className="order-2 space-y-3 xl:order-1">
          <div className="glass-quiet p-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-[#F0B250]" aria-hidden="true" />
              <p className="stage-label">Session</p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium leading-5 text-white">Aegis analyst</p>
              <NewChatButton tone="stage" onClick={history.newChat} />
            </div>
            <p className="mt-1 text-[11.5px] leading-[1.6] text-white/55">
              Reads only the aggregates this workspace has already computed. It never sees raw payment rows and never
              talks to another tenant.
            </p>
            <dl className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[11px]">
              {[
                { label: "Window", value: evidence.windowLabel },
                { label: "Scoring", value: evidence.modelVersion },
                { label: "Alert cutoff", value: String(evidence.cutoff) },
              ].map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-white/45">{item.label}</dt>
                  <dd className="num text-right text-white/80">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="glass-quiet p-3.5">
            <div className="flex items-center gap-2">
              <History className="size-3.5 text-white/55" aria-hidden="true" />
              <p className="stage-label">History</p>
              <span className="num ml-auto text-[11px] text-white/40">
                {history.sessions.length} saved
              </span>
            </div>
            <div className="mt-2.5">
              <ChatHistoryList
                sessions={history.sessions}
                activeId={history.activeId}
                onOpen={history.open}
                onRemove={history.remove}
                tone="stage"
                emptyHint="No saved conversations yet. Chats are kept on this device."
              />
            </div>
          </div>

          <div className="glass-quiet p-3.5">
            <p className="stage-label">Start with</p>
            <div className="mt-2.5 space-y-1.5">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  disabled={!evidence.configured || pending}
                  onClick={() => void ask(starter)}
                  className="w-full rounded-[10px] border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left text-[11.5px] leading-[1.5] text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 px-1 text-[11px] leading-4 text-white/40">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>Answers cite the window and the figures behind them. No legal or compliance determinations.</span>
          </div>
        </aside>

        {/* Conversation -------------------------------------------------- */}
        <div className="order-1 flex min-w-0 flex-col xl:order-2">
          <header className="flex flex-wrap items-start justify-between gap-3 px-1">
            <div>
              <p className="stage-label">Grounded console</p>
              <h1 className="mt-1 font-display text-[26px] font-semibold leading-8 tracking-[-0.03em] text-white sm:text-[30px] sm:leading-9">
                Ask the workspace
              </h1>
              <p className="mt-1.5 max-w-xl text-[12.5px] leading-5 text-white/55">
                Corridors, signals, exposure, the alert queue — answered from the {evidence.windowLabel} snapshot, with
                the evidence printed under every reply.
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                evidence.configured
                  ? "border-[#2DD4BF]/35 bg-[#2DD4BF]/10 text-[#7FE9DA]"
                  : "border-[#F0B250]/40 bg-[#F0B250]/10 text-[#F0B250]",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", evidence.configured ? "bg-[#2DD4BF]" : "bg-[#F0B250]")}
                aria-hidden="true"
              />
              {evidence.configured ? "Provider ready" : "Provider not configured"}
            </span>
          </header>

          {!evidence.configured ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#F0B250]/30 bg-[#F0B250]/8 px-3.5 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#F0B250]" aria-hidden="true" />
              <div className="text-[12px] leading-5">
                <p className="font-medium text-white">The model provider is not configured for this deployment</p>
                <p className="mt-0.5 text-white/60">
                  Set <span className="num">RIVER_API_KEY</span> in the server environment. The console keeps returning
                  a clear configuration error rather than a fabricated answer.
                </p>
              </div>
            </div>
          ) : null}

          <div
            ref={scroller}
            className="mt-4 min-h-[340px] flex-1 space-y-5 overflow-y-auto px-1 pb-4 pt-1 xl:max-h-[calc(100dvh-300px)]"
            aria-live="polite"
          >
            {turns.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <div className="relative flex size-16 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-white/12" aria-hidden="true" />
                  <span className="absolute inset-2 rounded-full border border-white/8" aria-hidden="true" />
                  <span className="size-2 rounded-full bg-[#F0B250] glow-dot" aria-hidden="true" />
                </div>
                <p className="mt-5 max-w-md font-display text-[17px] leading-6 text-white/85">
                  Every answer starts from the numbers on this page, not from a guess.
                </p>
                <p className="mt-2 max-w-sm text-[11.5px] leading-5 text-white/45">
                  Ask a question below, or pick a starting point on the left. The reply names its window and the
                  aggregates it used.
                </p>
              </div>
            ) : null}

            {turns.map((turn) => (
              <article key={turn.id} className="space-y-3">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-[16px] rounded-br-[4px] border border-white/12 bg-[linear-gradient(180deg,rgb(255_255_255/0.13),rgb(255_255_255/0.07))] px-3.5 py-2.5 text-[12.5px] leading-5 text-white/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.10),0_14px_28px_-22px_rgb(0_0_0/0.9)]">
                    {turn.question}
                  </p>
                </div>

                {turn.pending ? (
                  <div className="glass max-w-[92%] space-y-2.5 px-4 py-3.5" role="status">
                    <div className="flex items-center gap-2 text-[11px] text-white/55">
                      <Waves className="size-3.5 animate-pulse text-[#F0B250]" aria-hidden="true" />
                      Reading the workspace snapshot
                    </div>
                    <div className="pulse-line h-2 w-4/5 overflow-hidden rounded-full bg-white/8" />
                    <div className="pulse-line h-2 w-full overflow-hidden rounded-full bg-white/8" />
                    <div className="pulse-line h-2 w-3/5 overflow-hidden rounded-full bg-white/8" />
                  </div>
                ) : null}

                {turn.reply ? (
                  <div className="glass max-w-[92%] px-4 py-3.5 shadow-[0_24px_54px_-40px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.10)]">
                    <AnswerBody text={turn.reply.answer} />
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2.5 text-[11px] text-white/45">
                      {[
                        `window ${turn.reply.evidence.window}`,
                        `${turn.reply.evidence.payments.toLocaleString("en-US")} payments`,
                        `$${formatCompactNumber(turn.reply.evidence.valueUsd)} screened`,
                        `${turn.reply.evidence.flagged} flagged ≥ ${turn.reply.evidence.alertCutoff}`,
                      ].map((item) => (
                        <span key={item} className="num rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turn.error ? (
                  <div className="flex max-w-[92%] items-center gap-2 rounded-[14px] border border-[#F45E5E]/30 bg-[#F45E5E]/10 px-3.5 py-2.5 text-[12px] text-[#FFB4AE]">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{turn.error}</span>
                    {turn.error === "Stopped." ? null : (
                      <button
                        type="button"
                        onClick={() => void ask(turn.question)}
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

            {pending ? (
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/60">
                  Generating
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="size-1 animate-pulse rounded-full bg-white/60"
                        style={{ animationDelay: `${dot * 160}ms` }}
                      />
                    ))}
                  </span>
                  <button type="button" onClick={stop} className="ml-1 text-white/55 hover:text-white">
                    <CircleStop className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Stop generating</span>
                  </button>
                </span>
              </div>
            ) : null}
          </div>

          <form
            className="relative mt-1 shrink-0"
            onSubmit={(event) => {
              event.preventDefault();
              void ask();
            }}
          >
            <div className="glass flex items-end gap-2 p-2 pl-3.5">
              <label className="sr-only" htmlFor="console-question">
                Ask a question about this workspace
              </label>
              <textarea
                id="console-question"
                value={question}
                rows={1}
                maxLength={500}
                placeholder={evidence.configured ? "Ask about corridors, signals, exposure…" : "Provider not configured"}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask();
                  }
                }}
                className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-2 text-[13px] leading-5 text-white outline-none placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={listening}
                aria-label={listening ? "Stop voice input" : "Hold to speak"}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                  listening
                    ? "border-[#F45E5E]/50 bg-[#F45E5E]/20 text-[#FFB4AE]"
                    : "border-white/12 bg-white/[0.04] text-white/55 hover:text-white",
                )}
              >
                <Mic className="size-4" aria-hidden="true" />
              </button>
              {pending ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#0B111C]"
                  aria-label="Stop generating"
                >
                  <CircleStop className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={question.trim().length < 4 || !evidence.configured}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F0B250] text-[#161006] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Send question"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-white/35">
              <span>{voiceNote || (listening ? "Listening…" : "Enter to send · Shift + Enter for a new line")}</span>
              <span className="num">
                {evidence.payments.toLocaleString("en-US")} payments · ${formatCompactNumber(evidence.valueUsd)} in scope
              </span>
            </div>
          </form>
        </div>

        {/* Evidence rail -------------------------------------------------- */}
        <aside className="order-3 space-y-3">
          <div className="glass-quiet p-3.5">
            <p className="stage-label">Evidence in scope</p>
            <p className="num mt-2 text-[19px] font-medium leading-6 text-white">
              ${formatCompactNumber(evidence.valueUsd)}
            </p>
            <p className="mt-0.5 text-[11px] text-white/45">
              {evidence.payments.toLocaleString("en-US")} payments · {evidence.windowLabel}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Flagged", value: evidence.flagged.toLocaleString("en-US") },
                { label: "Avg score", value: String(evidence.avgScore) },
              ].map((item) => (
                <div key={item.label} className="rounded-[10px] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                  <p className="text-[11px] text-white/40">{item.label}</p>
                  <p className="num mt-1 text-[15px] leading-5 text-white/85">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="num mt-3 border-t border-white/10 pt-2.5 text-[11px] text-white/35">
              {evidence.from.slice(0, 10)} → {evidence.to.slice(0, 10)} UTC
            </p>
          </div>

          <div className="glass-quiet p-3.5">
            <p className="stage-label">Top corridors</p>
            <ul className="mt-2.5 space-y-2.5">
              {corridors.length === 0 ? (
                <li className="text-[11px] text-white/45">No mapped transfers in this window.</li>
              ) : (
                corridors.map((corridor) => (
                  <li key={corridor.corridor}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="num text-white/75">{corridor.corridor}</span>
                      <span className="num text-white/45">${formatCompactNumber(corridor.value)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#F0B250] to-[#FB923C]"
                        style={{ width: `${Math.max(4, (corridor.value / maxCorridor) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="glass-quiet p-3.5">
            <p className="stage-label">Signals firing</p>
            <ul className="mt-2.5 space-y-1.5">
              {evidence.signals.length === 0 ? (
                <li className="text-[11px] text-white/45">No signal crossed the reporting threshold.</li>
              ) : (
                evidence.signals.map((signal) => (
                  <li key={signal.label} className="flex items-start gap-2 text-[11px] leading-4">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-[#2DD4BF]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-white/60">{signal.label}</span>
                    <span className="num shrink-0 text-white/40">{signal.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
