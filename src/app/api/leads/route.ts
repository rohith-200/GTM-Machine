// 5. GET /api/leads — STUB
import type { Lead } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ leads: Lead[] }>(async () => ({
    leads: [...store().leads].sort((a, b) => b.fitScore - a.fitScore),
  }));
}
