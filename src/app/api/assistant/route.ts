import { fail, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth";
import { AiError, chat, getAiConfig } from "@/lib/ai/river";
import { SYSTEM_PROMPT, buildEvidence, buildUserPrompt } from "@/lib/ai/analyst";
import { getWorkspaceAnalytics } from "@/lib/data/analytics";
import { parseRange } from "@/lib/data/common";

export const runtime = "nodejs";

const MAX_QUESTION = 500;
const RATE_LIMIT = 15;
const WINDOW_MS = 10 * 60_000;

/**
 * Single-process rate limiting is enough here: the workspace is a single Node
 * server. A multi-instance deployment should move this to Redis, which the
 * project already configures for its API rate limits.
 */
const usage = new Map<string, number[]>();

function allow(userId: string): boolean {
  const now = Date.now();
  const recent = (usage.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    usage.set(userId, recent);
    return false;
  }
  recent.push(now);
  usage.set(userId, recent);
  return true;
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to use the analyst.", { status: 401 });
  if (!context.organization) return fail("no_organization", "Join a workspace first.", { status: 403 });

  const config = getAiConfig();
  if (!config.configured) {
    return fail("ai_not_configured", "The AI analyst is not configured for this deployment.", { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_body", "Expected a JSON body.", { status: 400 });
  }

  const payload = body as { question?: unknown; range?: unknown; page?: unknown };
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (question.length < 4) return fail("invalid_question", "Ask a question of at least four characters.", { status: 422 });
  if (question.length > MAX_QUESTION) {
    return fail("invalid_question", `Keep questions under ${MAX_QUESTION} characters.`, { status: 422 });
  }

  const range = parseRange(typeof payload.range === "string" ? payload.range : undefined);
  const page = typeof payload.page === "string" ? payload.page.slice(0, 40) : "overview";

  if (!allow(context.user.id)) {
    return fail("too_many_requests", "The analyst allows 15 questions per ten minutes. Try again shortly.", { status: 429 });
  }

  const analytics = await getWorkspaceAnalytics(context.supabase, context.organization.id, range);
  const evidence = buildEvidence(analytics);

  try {
    const result = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(question, evidence, page) },
    ]);

    return ok({
      answer: result.content,
      model: result.model,
      usage: result.usage,
      evidence: {
        window: evidence.window.label,
        from: evidence.window.from,
        to: evidence.window.to,
        payments: evidence.totals.count,
        valueUsd: evidence.totals.value,
        flagged: evidence.totals.flagged,
        alertCutoff: evidence.methodology.alertCutoff,
        series: evidence.flow.map((point) => ({ period: point.period, payments: point.payments, flagged: point.flagged })),
        corridors: evidence.corridors.map((corridor) => corridor.corridor),
      },
    });
  } catch (error) {
    if (error instanceof AiError) {
      const status =
        error.code === "unauthorized"
          ? 502
          : error.code === "rate_limited"
            ? 429
            : error.code === "not_configured"
              ? 503
              : 502;
      return fail(error.code, error.message, { status });
    }
    return fail("ai_error", "The analyst could not produce an answer.", { status: 502 });
  }
}
