"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { DEMO_PRESETS, buildDemoDataset, type DemoDataset } from "@/lib/demo/generator";

export interface DemoActionResult {
  ok: boolean;
  message: string;
  summary?: DemoDataset["summary"] | undefined;
  failedStep?: string | undefined;
}

/** Insert in bounded batches so a large dataset cannot hit a single-request limit. */
const BATCH_SIZE = 400;

/** A workspace can generate three datasets every ten minutes; it is additive data. */
const RUN_LIMIT = 3;
const RUN_WINDOW_MS = 10 * 60_000;
const runs = new Map<string, number[]>();

function allowRun(userId: string): boolean {
  const now = Date.now();
  const recent = (runs.get(userId) ?? []).filter((at) => now - at < RUN_WINDOW_MS);
  if (recent.length >= RUN_LIMIT) {
    runs.set(userId, recent);
    return false;
  }
  recent.push(now);
  runs.set(userId, recent);
  return true;
}

export async function generateDemoData(input: {
  presetId?: string;
  typologies?: boolean;
}): Promise<DemoActionResult> {
  const context = await getAuthContext();
  if (!context || !context.organization) {
    return { ok: false, message: "Sign in to a workspace before generating demo data." };
  }
  if (context.profile.role === "viewer") {
    return { ok: false, message: "Viewers can read demo data but cannot generate it." };
  }

  const preset = DEMO_PRESETS.find((entry) => entry.id === input.presetId) ?? DEMO_PRESETS[1]!;
  if (!allowRun(context.user.id)) {
    return {
      ok: false,
      message: "Demo generation is limited to three runs per ten minutes. Try again shortly.",
    };
  }

  const organizationId = context.organization.id;
  const seed = Date.now() % 1_000_000_000;
  let dataset: DemoDataset;
  try {
    dataset = buildDemoDataset({
      organizationId,
      payments: preset.payments,
      days: preset.days,
      seed,
      typologies: input.typologies ?? true,
    });
  } catch {
    return { ok: false, message: "The generator could not build a dataset. Nothing was written." };
  }

  const supabase = context.supabase;

  const insertBatches = async (
    label: string,
    rows: unknown[],
    insert: (chunk: unknown[]) => PromiseLike<{ error: { message: string } | null }>,
  ): Promise<string | null> => {
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const { error } = await insert(rows.slice(index, index + BATCH_SIZE));
      if (error) return `${label}: ${error.message}`;
    }
    return null;
  };

  const failure =
    (await insertBatches("Entities", dataset.entities, (chunk) =>
      supabase.from("entities").insert(chunk as never),
    )) ??
    (await insertBatches("Accounts", dataset.accounts, (chunk) =>
      supabase.from("accounts").insert(chunk as never),
    )) ??
    (await insertBatches("Payments", dataset.transactions, (chunk) =>
      supabase.from("transactions").insert(chunk as never),
    )) ??
    (await insertBatches("Alerts", dataset.alerts, (chunk) => supabase.from("alerts").insert(chunk as never)));

  if (failure) {
    revalidatePath("/app/library");
    return {
      ok: false,
      message: `Demo generation stopped partway: ${failure}. Rows written before the failure remain — demo rows are identifiable by the DEMO- payment reference.`,
      failedStep: failure.split(":")[0],
    };
  }

  for (const path of [
    "/app/library",
    "/app/overview",
    "/app/analytics",
    "/app/transactions",
    "/app/alerts",
    "/app/network",
    "/app/corridors",
  ]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    message: `${dataset.summary.payments.toLocaleString("en-US")} scored payments across ${dataset.summary.days} days, with ${dataset.summary.alerts} alerts.`,
    summary: dataset.summary,
  };
}

