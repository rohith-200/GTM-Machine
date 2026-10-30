// 4. POST /api/discover — STUB
import type { DiscoverRequest, Lead, Competitor } from "@/contract/types";
import { handle, readBody, requireFields } from "@/lib/http";
import { store, stubLog, stubEvent } from "@/lib/stub-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle<{ leads: Lead[]; competitors: Competitor[] }>(async () => {
    const body = await readBody<DiscoverRequest>(req);
    requireFields(body, ["icpId"]);
    const steps = [
      "Building search queries from ICP",
      "Searching Tavily: logistics companies new CFO 2026",
      "Extracting companies and people with Nebius",
      "Scoring leads against ICP",
    ];
    for (const s of steps) {
      stubLog("discover", s);
      await new Promise((r) => setTimeout(r, 700));
    }
    stubLog("graph", "Wrote leads to Neo4j", "success");
    stubEvent("ai", "leads_discovered", `Discovered ${store().leads.length} leads`, null);
    const s = store();
    return { leads: [...s.leads].sort((a, b) => b.fitScore - a.fitScore), competitors: s.competitors };
  });
}
