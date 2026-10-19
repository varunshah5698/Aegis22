import { fail, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to read notifications.", { status: 401 });

  const { data, error } = await context.supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return fail("database_error", error.message, { status: 500 });

  const unread = (data ?? []).filter((row) => !row.read_at).length;
  return ok({ notifications: data ?? [], unread });
}

export async function POST() {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to update notifications.", { status: 401 });

  const { error } = await context.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", context.user.id)
    .is("read_at", null);

  if (error) return fail("database_error", error.message, { status: 500 });
  return ok({ read: true });
}
