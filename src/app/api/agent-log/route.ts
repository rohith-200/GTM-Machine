// 13b. GET /api/agent-log?since= — STUB
import type { NextRequest } from "next/server";
import type { AgentLog } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET(req: NextRequest) {
  return handle<{ logs: AgentLog[] }>(async () => {
    const since = req.nextUrl.searchParams.get("since");
    const logs = [...store().logs]
      .filter((l) => !since || l.timestamp > since)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100);
    return { logs };
  });
}
