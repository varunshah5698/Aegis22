import { describe, expect, it } from "vitest";

import { buildMessages, parseHistory } from "@/lib/ai/conversation";

describe("parseHistory", () => {
  it("accepts well-formed pairs", () => {
    const pairs = parseHistory([
      { question: "What changed in this window?", answer: "Value rose 12%." },
      { question: "Which corridor?", answer: "AE-IN dominates." },
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ question: "What changed in this window?", answer: "Value rose 12%." });
  });

  it("drops malformed entries instead of failing the request", () => {
    const pairs = parseHistory([
      null,
      "just a string",
      { question: "abc", answer: "ok" }, // question under 4 chars
      { question: "No answer here" },
      { question: 42, answer: "nope" },
      { question: "Valid question", answer: "Valid answer" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.question).toBe("Valid question");
  });

  it("returns an empty list for non-array input", () => {
    expect(parseHistory(undefined)).toEqual([]);
    expect(parseHistory("history")).toEqual([]);
    expect(parseHistory({})).toEqual([]);
  });

  it("caps the pair count and per-field length", () => {
    const input = Array.from({ length: 20 }, (_, index) => ({
      question: `question ${index} ${"q".repeat(600)}`,
      answer: "a".repeat(5000),
    }));
    const pairs = parseHistory(input);
    expect(pairs).toHaveLength(8);
    expect(pairs[0]?.question.length).toBe(500);
    expect(pairs[0]?.answer.length).toBe(2000);
  });
});

describe("buildMessages", () => {
  it("orders system, prior turns and the current prompt", () => {
    const messages = buildMessages({
      system: "SYSTEM RULES",
      history: [
        { question: "Earlier question", answer: "Earlier answer" },
        { question: "Follow-up", answer: "Follow-up answer" },
      ],
      userPrompt: "CURRENT PROMPT WITH EVIDENCE",
    });

    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[0]?.content).toBe("SYSTEM RULES");
    expect(messages[1]).toEqual({ role: "user", content: "Earlier question" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Earlier answer" });
    expect(messages[messages.length - 1]?.content).toBe("CURRENT PROMPT WITH EVIDENCE");
  });

  it("sends just system plus the prompt when there is no history", () => {
    const messages = buildMessages({ system: "S", history: [], userPrompt: "Q" });
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: "user", content: "Q" });
  });
});
