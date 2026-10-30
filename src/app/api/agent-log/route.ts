// 13b. GET /api/agent-log?since= — REAL (Neo4j)
import type { NextRequest } from "next/server";
import type { AgentLog } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { run } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

export async function GET(req: NextRequest) {
  return handle<{ logs: AgentLog[] }>(async () => {
    const since = req.nextUrl.searchParams.get("since");
    if (useFixtures()) {
      const logs = store().logs.filter((l) => !since || l.timestamp > since).slice(0, 100);
      return { logs };
    }
    const logs = await run<AgentLog>(
      `MATCH (l:AgentLog)
       WHERE $since IS NULL OR l.timestamp > $since
       RETURN l.id AS id, l.step AS step, l.message AS message, l.level AS level, l.timestamp AS timestamp
       ORDER BY l.timestamp DESC LIMIT 100`,
      { since },
    );
    return { logs };
  });
}
