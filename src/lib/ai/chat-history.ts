"use client";

import * as React from "react";

/**
 * Chat history for the AI analyst.
 *
 * Conversations are persisted per surface (analyst console, assistant drawer,
 * analytics panel) and per workspace scope, so a user can leave the page,
 * come back, and continue where they stopped. Everything lives in
 * localStorage: no question or answer ever leaves the browser except the
 * normal /api/assistant call, and every read/write is defensive so a full
 * quota or private-mode browser degrades to an in-memory session instead of
 * crashing the panel.
 */

export interface AssistantReply {
  answer: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  evidence: {
    window: string;
    from: string;
    to: string;
    payments: number;
    valueUsd: number;
    flagged: number;
    alertCutoff: number;
    corridors: string[];
    series?: Array<{ period: string; payments: number; flagged: number }>;
  };
}

export interface ChatTurn {
  id: string;
  question: string;
  reply: AssistantReply | null;
  error: string | null;
  pending: boolean;
}

export interface StoredTurn {
  id: string;
  question: string;
  reply: AssistantReply | null;
  error: string | null;
  at: number;
}

export interface ChatSession {
  id: string;
  scope: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: StoredTurn[];
}

/** A completed exchange handed to /api/assistant as conversational memory. */
export interface HistoryPair {
  question: string;
  answer: string;
}

const KEY_PREFIX = "aegis:analyst-history:v1:";
const MAX_SESSIONS = 12;
const MAX_TURNS = 60;
const MAX_STORED_ANSWER = 6_000;
const MAX_PROMPT_PAIRS = 6;
const MAX_PROMPT_ANSWER = 2_000;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeReply(value: unknown): AssistantReply | null {
  if (!isRecord(value)) return null;
  if (typeof value.answer !== "string" || value.answer.length === 0) return null;
  const evidence = isRecord(value.evidence) ? value.evidence : {};
  const usage = isRecord(value.usage) ? value.usage : null;
  return {
    answer: value.answer.slice(0, MAX_STORED_ANSWER),
    model: typeof value.model === "string" ? value.model : "model",
    usage: usage
      ? {
          promptTokens: Number(usage.promptTokens) || 0,
          completionTokens: Number(usage.completionTokens) || 0,
          totalTokens: Number(usage.totalTokens) || 0,
        }
      : null,
    evidence: {
      window: typeof evidence.window === "string" ? evidence.window : "",
      from: typeof evidence.from === "string" ? evidence.from : "",
      to: typeof evidence.to === "string" ? evidence.to : "",
      payments: Number(evidence.payments) || 0,
      valueUsd: Number(evidence.valueUsd) || 0,
      flagged: Number(evidence.flagged) || 0,
      alertCutoff: Number(evidence.alertCutoff) || 0,
      corridors: Array.isArray(evidence.corridors)
        ? evidence.corridors.filter((item): item is string => typeof item === "string").slice(0, 10)
        : [],
    },
  };
}

function sanitizeSession(value: unknown, scope: string): ChatSession | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (!Array.isArray(value.turns)) return null;
  const turns: StoredTurn[] = [];
  for (const raw of value.turns.slice(0, MAX_TURNS)) {
    if (!isRecord(raw)) continue;
    if (typeof raw.question !== "string" || raw.question.length === 0) continue;
    const reply = sanitizeReply(raw.reply);
    const error = typeof raw.error === "string" && raw.error.length > 0 ? raw.error : null;
    if (!reply && !error) continue;
    turns.push({
      id: typeof raw.id === "string" ? raw.id : `${turns.length}`,
      question: raw.question.slice(0, 500),
      reply,
      error,
      at: Number(raw.at) || 0,
    });
  }
  if (turns.length === 0) return null;
  return {
    id: value.id,
    scope: typeof value.scope === "string" ? value.scope : scope,
    title:
      typeof value.title === "string" && value.title.length > 0
        ? value.title.slice(0, 80)
        : (turns[0]?.question ?? "").slice(0, 80),
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
    turns,
  };
}

/** Newest first, scoped to the workspace, never throwing. */
export function loadSessions(surface: string, scope: string): ChatSession[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY_PREFIX + surface);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions: ChatSession[] = [];
    for (const item of parsed) {
      const session = sanitizeSession(item, scope);
      if (session && session.scope === scope) sessions.push(session);
    }
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions.slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

/** Upsert one session, keep newest-first order and the session cap. */
export function persistSession(surface: string, session: ChatSession): ChatSession[] {
  const store = storage();
  const trimmed: ChatSession = {
    ...session,
    turns: session.turns.slice(-MAX_TURNS),
    title: session.title.slice(0, 80),
  };
  if (!store) return [trimmed];
  try {
    const priorList = loadSessions(surface, session.scope);
    const prior = priorList.find((item) => item.id === trimmed.id);
    if (prior) {
      // The caller does not hold the original metadata; keep it stable.
      trimmed.createdAt = prior.createdAt;
      trimmed.title = prior.title;
    }
    const next = [trimmed, ...priorList.filter((item) => item.id !== trimmed.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS);
    store.setItem(KEY_PREFIX + surface, JSON.stringify(next));
    return next;
  } catch {
    return [trimmed];
  }
}

export function removeSession(surface: string, scope: string, id: string): ChatSession[] {
  const store = storage();
  const remaining = loadSessions(surface, scope).filter((item) => item.id !== id);
  try {
    if (store) store.setItem(KEY_PREFIX + surface, JSON.stringify(remaining));
  } catch {
    /* quota: the list still updates in memory for this page view */
  }
  return remaining;
}

/** Settled turns only — in-flight pending turns are not worth persisting. */
export function turnsToStored(turns: ChatTurn[]): StoredTurn[] {
  const at = Date.now();
  return turns
    .filter((turn) => turn.reply !== null || turn.error !== null)
    .map((turn) => ({ id: turn.id, question: turn.question, reply: turn.reply, error: turn.error, at }));
}

export function storedToTurns(session: ChatSession): ChatTurn[] {
  return session.turns.map((turn) => ({
    id: turn.id,
    question: turn.question,
    reply: turn.reply,
    error: turn.error,
    pending: false,
  }));
}

/**
 * The pairs sent to /api/assistant so the model can follow a follow-up.
 * Bounded on purpose: answers get truncated and only the recent tail is kept,
 * which keeps the prompt inside a sane token budget.
 */
export function pairsForPrompt(turns: ChatTurn[]): HistoryPair[] {
  const pairs: HistoryPair[] = [];
  for (const turn of turns) {
    if (!turn.reply || turn.pending) continue;
    pairs.push({ question: turn.question, answer: turn.reply.answer.slice(0, MAX_PROMPT_ANSWER) });
  }
  return pairs.slice(-MAX_PROMPT_PAIRS);
}

export function sessionTitle(turns: ChatTurn[]): string {
  const first = turns.find((turn) => turn.question.trim().length > 0);
  return (first?.question ?? "New conversation").slice(0, 80);
}

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ChatHistoryApi {
  /** Restored sessions for this surface, newest first. */
  sessions: ChatSession[];
  activeId: string | null;
  turns: ChatTurn[];
  setTurns: React.Dispatch<React.SetStateAction<ChatTurn[]>>;
  /** False until localStorage has been read (avoids a hydration flash). */
  ready: boolean;
  /** True while a reply is in flight — session switching is blocked then. */
  generating: boolean;
  /**
   * Id of the conversation being written. Assigned even for a brand-new chat
   * (so its first turn has a destination) — a new id is not persisted until
   * the chat has a settled turn.
   */
  newChat: () => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  /** Completed exchanges to attach to the next /api/assistant call. */
  promptHistory: () => HistoryPair[];
}

/**
 * State wrapper: restores the most recent conversation for the surface on
 * mount, persists settled turns as they change, and exposes session
 * switching. An empty new chat is only written once it has real content.
 */
export function useChatHistory({ surface, scope = "default" }: { surface: string; scope?: string }): ChatHistoryApi {
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const restored = loadSessions(surface, scope);
    setSessions(restored);
    const active = restored[0] ?? null;
    // A fresh conversation gets its id up front so the first settled turn has
    // somewhere to persist; it is only written once it has content.
    setActiveId(active?.id ?? newSessionId());
    setTurns(active ? storedToTurns(active) : []);
    setReady(true);
  }, [surface, scope]);

  React.useEffect(() => {
    if (!ready || !activeId) return;
    const stored = turnsToStored(turns);
    if (stored.length === 0) return;
    const session: ChatSession = {
      id: activeId,
      scope,
      title: stored[0]?.question.slice(0, 80) ?? "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: stored,
    };
    // persistSession keeps the original createdAt/title for an existing id.
    setSessions(persistSession(surface, session));
  }, [turns, ready, activeId, surface, scope]);

  // Switching away mid-answer would strand the in-flight turn, so both
  // actions ignore while anything is still pending.
  const generating = turns.some((turn) => turn.pending);

  const newChat = React.useCallback(() => {
    if (turns.some((turn) => turn.pending)) return;
    setActiveId(newSessionId());
    setTurns([]);
  }, [turns]);

  const open = React.useCallback(
    (id: string) => {
      if (turns.some((turn) => turn.pending)) return;
      const session = sessions.find((item) => item.id === id);
      if (!session) return;
      setActiveId(session.id);
      setTurns(storedToTurns(session));
    },
    [sessions, turns],
  );

  const remove = React.useCallback(
    (id: string) => {
      const remaining = removeSession(surface, scope, id);
      setSessions(remaining);
      if (activeId === id) {
        const next = remaining[0] ?? null;
        setActiveId(next?.id ?? newSessionId());
        setTurns(next ? storedToTurns(next) : []);
      }
    },
    [surface, scope, activeId],
  );

  const promptHistory = React.useCallback(() => pairsForPrompt(turns), [turns]);

  return { sessions, activeId, turns, setTurns, ready, generating, newChat, open, remove, promptHistory };
}
