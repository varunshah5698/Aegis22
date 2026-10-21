import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  loadSessions,
  pairsForPrompt,
  persistSession,
  removeSession,
  turnsToStored,
  useChatHistory,
  type AssistantReply,
  type ChatSession,
  type ChatTurn,
} from "@/lib/ai/chat-history";

function reply(answer: string): AssistantReply {
  return {
    answer,
    model: "test-model",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    evidence: {
      window: "last 7 days",
      from: "2026-10-01",
      to: "2026-10-07",
      payments: 42,
      valueUsd: 1000,
      flagged: 3,
      alertCutoff: 70,
      corridors: ["AE-IN"],
    },
  };
}

function turn(id: string, question: string, options: { answer?: string; error?: string; pending?: boolean } = {}): ChatTurn {
  return {
    id,
    question,
    reply: options.answer ? reply(options.answer) : null,
    error: options.error ?? null,
    pending: options.pending ?? false,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("session persistence", () => {
  it("round-trips a session and returns newest first", () => {
    const base: ChatSession = {
      id: "a",
      scope: "org-1",
      title: "First question",
      createdAt: 1000,
      updatedAt: 1000,
      turns: [{ id: "t1", question: "First question", reply: reply("answer one"), error: null, at: 1000 }],
    };
    persistSession("console", base);
    persistSession("console", {
      ...base,
      id: "b",
      title: "Second question",
      createdAt: 2000,
      updatedAt: 2000,
      turns: [{ id: "t2", question: "Second question", reply: reply("answer two"), error: null, at: 2000 }],
    });

    const list = loadSessions("console", "org-1");
    expect(list.map((session) => session.id)).toEqual(["b", "a"]);
    expect(list[0]?.turns[0]?.reply?.answer).toBe("answer two");
    expect(list[0]?.turns[0]?.reply?.evidence.corridors).toEqual(["AE-IN"]);
  });

  it("never returns another workspace's sessions", () => {
    persistSession("console", {
      id: "a",
      scope: "org-1",
      title: "Tenant one",
      createdAt: 1,
      updatedAt: 1,
      turns: [{ id: "t1", question: "Tenant one", reply: reply("private"), error: null, at: 1 }],
    });

    expect(loadSessions("console", "org-2")).toHaveLength(0);
    expect(loadSessions("console", "org-1")).toHaveLength(1);
    expect(loadSessions("drawer", "org-1")).toHaveLength(0);
  });

  it("keeps the original title and createdAt when a session is re-persisted", () => {
    const first: ChatSession = {
      id: "a",
      scope: "org-1",
      title: "Original title",
      createdAt: 111,
      updatedAt: 111,
      turns: [{ id: "t1", question: "Original title", reply: reply("one"), error: null, at: 111 }],
    };
    persistSession("console", first);
    persistSession("console", {
      ...first,
      title: "Should not win",
      createdAt: 999,
      updatedAt: 222,
      turns: [
        { id: "t1", question: "Original title", reply: reply("one"), error: null, at: 111 },
        { id: "t2", question: "Follow-up", reply: reply("two"), error: null, at: 222 },
      ],
    });

    const [session] = loadSessions("console", "org-1");
    expect(session?.title).toBe("Original title");
    expect(session?.createdAt).toBe(111);
    expect(session?.turns).toHaveLength(2);
  });

  it("survives corrupt storage without throwing", () => {
    window.localStorage.setItem("aegis:analyst-history:v1:console", "{not json");
    expect(loadSessions("console", "org-1")).toEqual([]);

    window.localStorage.setItem("aegis:analyst-history:v1:console", JSON.stringify([{ junk: true }, null, 5]));
    expect(loadSessions("console", "org-1")).toEqual([]);
  });

  it("removes a session", () => {
    persistSession("console", {
      id: "a",
      scope: "org-1",
      title: "Doomed",
      createdAt: 1,
      updatedAt: 1,
      turns: [{ id: "t1", question: "Doomed", reply: reply("x"), error: null, at: 1 }],
    });
    const remaining = removeSession("console", "org-1", "a");
    expect(remaining).toEqual([]);
    expect(loadSessions("console", "org-1")).toEqual([]);
  });
});

describe("turn conversion", () => {
  it("drops in-flight pending turns and keeps settled or errored ones", () => {
    const stored = turnsToStored([
      turn("1", "Asked", { answer: "Answered" }),
      turn("2", "In flight", { pending: true }),
      turn("3", "Failed", { error: "The analyst did not answer." }),
    ]);
    expect(stored.map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("builds bounded prompt pairs from the tail of the conversation", () => {
    const turns: ChatTurn[] = Array.from({ length: 10 }, (_, index) =>
      turn(`t${index}`, `question ${index}`, { answer: "x".repeat(3000) }),
    );
    const pairs = pairsForPrompt(turns);
    expect(pairs).toHaveLength(6);
    expect(pairs.map((pair) => pair.question)).toEqual([
      "question 4",
      "question 5",
      "question 6",
      "question 7",
      "question 8",
      "question 9",
    ]);
    expect(pairs[0]?.answer.length).toBe(2000);
    // A pending turn never becomes memory.
    expect(pairsForPrompt([turn("p", "hmm", { pending: true })])).toEqual([]);
  });
});

describe("useChatHistory", () => {
  it("restores the most recent conversation after a remount", async () => {
    const first = renderHook(() => useChatHistory({ surface: "console", scope: "org-1" }));
    await waitFor(() => expect(first.result.current.ready).toBe(true));

    act(() => {
      first.result.current.setTurns([turn("1", "What changed?", { answer: "Volume is up 12%." })]);
    });
    await waitFor(() => expect(first.result.current.sessions).toHaveLength(1));
    const savedId = first.result.current.activeId;
    first.unmount();

    // "Leave the page" — a fresh mount, as when the user comes back.
    const second = renderHook(() => useChatHistory({ surface: "console", scope: "org-1" }));
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.activeId).toBe(savedId);
    expect(second.result.current.turns).toHaveLength(1);
    expect(second.result.current.turns[0]?.question).toBe("What changed?");
    expect(second.result.current.turns[0]?.reply?.answer).toBe("Volume is up 12%.");
    expect(second.result.current.promptHistory()).toEqual([
      { question: "What changed?", answer: "Volume is up 12%." },
    ]);
  });

  it("switches between saved conversations and starts a clean new one", async () => {
    const { result, unmount } = renderHook(() => useChatHistory({ surface: "console", scope: "org-1" }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setTurns([turn("1", "First chat", { answer: "one" })]);
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    const firstId = result.current.activeId;

    act(() => result.current.newChat());
    expect(result.current.turns).toHaveLength(0);
    act(() => {
      result.current.setTurns([turn("2", "Second chat", { answer: "two" })]);
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    const secondId = result.current.activeId;
    expect(secondId).not.toBe(firstId);

    // Empty new chats are not written to storage.
    act(() => result.current.newChat());
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));

    act(() => result.current.open(firstId!));
    expect(result.current.turns[0]?.question).toBe("First chat");

    unmount();
    const again = renderHook(() => useChatHistory({ surface: "console", scope: "org-1" }));
    await waitFor(() => expect(again.result.current.ready).toBe(true));
    expect(again.result.current.sessions).toHaveLength(2);
    expect(again.result.current.turns[0]?.question).toBe("First chat");
  });

  it("blocks session switching while a reply is in flight", async () => {
    const { result } = renderHook(() => useChatHistory({ surface: "console", scope: "org-1" }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setTurns([
        turn("1", "Saved chat", { answer: "done" }),
        turn("2", "Generating", { pending: true }),
      ]);
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.generating).toBe(true);

    const sessionsBefore = result.current.sessions;
    act(() => result.current.newChat());
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.sessions).toBe(sessionsBefore);
  });
});
