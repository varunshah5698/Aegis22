import { getAuthContext } from "@/lib/auth";
import { fail } from "@/lib/api/response";
import { parseRange, rangeWindow } from "@/lib/data/common";
import { LIMITS } from "@/config/risk";

export const runtime = "nodejs";

const PAGE = 1_000;
const COLUMNS = [
  "external_id",
  "created_at",
  "sender_name",
  "receiver_name",
  "sender_country",
  "receiver_country",
  "amount",
  "currency",
  "amount_base",
  "risk_score",
  "risk_level",
  "status",
] as const;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Streams the workspace's scored payments as CSV, scoped by RLS and organisation. */
export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to export data.", { status: 401 });
  if (!context.organization) return fail("no_organization", "Join a workspace first.", { status: 403 });

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range") ?? undefined, "90d");
  const { from } = rangeWindow(range);

  const rows: Array<Record<(typeof COLUMNS)[number], unknown>> = [];
  for (let offset = 0; offset < LIMITS.exportRows; offset += PAGE) {
    const { data, error } = await context.supabase
      .from("transactions")
      .select(
        "external_id, created_at, sender_name, receiver_name, sender_country, receiver_country, amount, currency, amount_base, risk_score, risk_level, status",
      )
      .eq("organization_id", context.organization.id)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: false })
      .range(offset, Math.min(offset + PAGE, LIMITS.exportRows) - 1);

    if (error) return fail(error.code ?? "database_error", error.message, { status: 400 });
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const header = COLUMNS.join(",");
  const body = [header, ...rows.map((row) => COLUMNS.map((column) => cell(row[column])).join(","))].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="aegis-transactions-${range}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
