/**
 * Conversation assembly for /api/assistant.
 *
 * Pure functions so the history contract is testable without touching the
 * network or the server-only grounding layer. Client-supplied history is
 * untrusted: it is capped, length-limited and type-checked before it is
 * allowed anywhere near the model prompt.
 */

export interface HistoryPair {
  question: string;
  answer: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_PAIRS = 8;
const MAX_QUESTION_CHARS = 500;
const MAX_ANSWER_CHARS = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates the `history` field of the request body. Anything malformed is
 * dropped rather than failing the request: a follow-up should still answer
 * even if an older turn did not survive sanitisation.
 */
export function parseHistory(input: unknown): HistoryPair[] {
  if (!Array.isArray(input)) return [];
  const pairs: HistoryPair[] = [];
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
    if (question.length < 4 || answer.length === 0) continue;
    pairs.push({
      question: question.slice(0, MAX_QUESTION_CHARS),
      answer: answer.slice(0, MAX_ANSWER_CHARS),
    });
    if (pairs.length >= MAX_PAIRS) break;
  }
  return pairs;
}

/**
 * Messages sent to the provider: system rules, the prior exchanges as real
 * user/assistant turns (so the model reads them as its own conversation),
 * then the current question carrying the evidence snapshot.
 */
export function buildMessages(options: {
  system: string;
  history: HistoryPair[];
  userPrompt: string;
}): ConversationMessage[] {
  const messages: ConversationMessage[] = [{ role: "system", content: options.system }];
  for (const pair of options.history) {
    messages.push({ role: "user", content: pair.question });
    messages.push({ role: "assistant", content: pair.answer });
  }
  messages.push({ role: "user", content: options.userPrompt });
  return messages;
}
