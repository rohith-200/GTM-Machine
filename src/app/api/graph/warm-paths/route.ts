// 12. GET /api/graph/warm-paths?leadId= — STUB
import type { NextRequest } from "next/server";
import type { WarmPath } from "@/contract/types";
import { handle, ApiError } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET(req: NextRequest) {
  return handle<{ paths: WarmPath[] }>(async () => {
    const leadId = req.nextUrl.searchParams.get("leadId");
    if (!leadId) throw new ApiError("BAD_REQUEST", "leadId is required");
    return { paths: store().warmPaths.filter((p) => p.leadId === leadId) };
  });
}
