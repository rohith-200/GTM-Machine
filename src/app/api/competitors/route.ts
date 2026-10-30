// 6. GET /api/competitors — STUB
import type { Competitor } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ competitors: Competitor[] }>(async () => ({ competitors: store().competitors }));
}
