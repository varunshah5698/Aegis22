import { getAuthContext } from "@/lib/auth";
import { fail } from "@/lib/api/response";

export const runtime = "nodejs";

const HEADER = [
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
].join(",");

const EXAMPLE = [
  "PMT-2026-0001",
  "2026-10-18T09:30:00Z",
  "Northwind Trading Ltd",
  "Halcyon Holdings BV",
  "GB",
  "NL",
  "18500.00",
  "GBP",
  "23400.00",
  "72",
  "high",
  "settled",
].join(",");

/** Template for the authenticated ingestion endpoint; never accepts a file itself. */
export async function GET() {
  const context = await getAuthContext();
  if (!context) return fail("unauthorized", "Sign in to download the template.", { status: 401 });

  return new Response(`${HEADER}\r\n${EXAMPLE}\r\n`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="aegis-transactions-template.csv"',
      "cache-control": "no-store",
    },
  });
}
