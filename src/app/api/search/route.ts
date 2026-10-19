import { fail, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context || !context.profile.organization_id) {
    return fail("unauthorized", "Sign in to search the workspace.", { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return ok({ transactions: [], alerts: [], cases: [], rules: [], entities: [] });

  const organizationId = context.profile.organization_id;
  const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;

  const [transactions, alerts, cases, rules, entities] = await Promise.all([
    context.supabase
      .from("transactions")
      .select("id, external_id, sender_name, receiver_name, risk_level, amount, currency")
      .eq("organization_id", organizationId)
      .ilike("external_id", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    context.supabase
      .from("alerts")
      .select("id, title, severity, status")
      .eq("organization_id", organizationId)
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    context.supabase
      .from("cases")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .ilike("title", pattern)
      .limit(5),
    context.supabase
      .from("rules")
      .select("id, name, status")
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .limit(5),
    context.supabase
      .from("entities")
      .select("id, legal_name, country, kind")
      .eq("organization_id", organizationId)
      .ilike("legal_name", pattern)
      .limit(5),
  ]);

  return ok({
    transactions: transactions.data ?? [],
    alerts: alerts.data ?? [],
    cases: cases.data ?? [],
    rules: rules.data ?? [],
    entities: entities.data ?? [],
  });
}
