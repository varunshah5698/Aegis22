import "server-only";

/**
 * Server-only client for the River chat completions API.
 *
 * Credentials never leave the server: the browser only ever talks to
 * /api/assistant. Requests are bounded by a timeout and a token cap so a slow
 * provider cannot hold a page render open.
 */

export type AiErrorCode = "not_configured" | "unauthorized" | "rate_limited" | "unavailable" | "invalid_response";

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

export interface AiConfig {
  baseUrl: string;
  model: string;
  configured: boolean;
}

export function getAiConfig(): AiConfig {
  const baseUrl = (process.env.RIVER_BASE_URL ?? "https://api.river.ai/v1").replace(/\/+$/, "");
  const model = process.env.RIVER_MODEL ?? "deepseek-ai/DeepSeek-V4.1-Flash";
  return { baseUrl, model, configured: Boolean(process.env.RIVER_API_KEY) };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 700;

export async function chat(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult> {
  const apiKey = process.env.RIVER_API_KEY;
  const config = getAiConfig();
  if (!apiKey) {
    throw new AiError("not_configured", "The AI analyst is not configured. Set RIVER_API_KEY in .env.local.");
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options.maxTokens ?? MAX_TOKENS,
        temperature: options.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name === "TimeoutError" ? "request timed out" : error.message : "network error";
    // Deliberately excludes headers so the key can never reach a log line.
    throw new AiError("unavailable", `The AI provider could not be reached (${reason}).`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AiError("unauthorized", "The AI provider rejected the configured key.");
  }
  if (response.status === 429) {
    throw new AiError("rate_limited", "The AI provider is rate limiting this workspace. Try again in a moment.");
  }
  if (!response.ok) {
    throw new AiError("unavailable", `The AI provider responded with ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiError("invalid_response", "The AI provider returned a response that was not valid JSON.");
  }

  const data = payload as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AiError("invalid_response", "The AI provider returned an empty answer.");
  }

  return {
    content: content.trim(),
    model: typeof data.model === "string" ? data.model : config.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : null,
  };
}
