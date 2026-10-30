// 13a. GET /api/activity — REAL (Neo4j)
import type { ActivityEvent } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { run } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ events: ActivityEvent[] }>(async () => {
    if (useFixtures()) return { events: store().events.slice(0, 100) };
    const events = await run<ActivityEvent>(
      `MATCH (e:Event)
       RETURN e.id AS id, e.leadId AS leadId, e.actor AS actor, e.action AS action, e.detail AS detail, e.timestamp AS timestamp
       ORDER BY e.timestamp DESC LIMIT 100`,
    );
    return { events };
  });
}
