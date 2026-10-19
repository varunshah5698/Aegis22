import { fail, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth";
import { getTransactionDetail } from "@/lib/data/transactions";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || !context.profile.organization_id) {
    return fail("unauthorized", "Sign in to read transactions.", { status: 401 });
  }

  const { id } = await params;
  const detail = await getTransactionDetail(context.supabase, context.profile.organization_id, id);
  if (!detail) return fail("not_found", "Transaction not found.", { status: 404 });

  return ok(detail);
}
